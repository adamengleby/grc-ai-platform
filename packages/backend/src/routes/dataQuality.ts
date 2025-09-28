import { Router } from 'express';
import { useCaseController } from '@/controllers/useCaseController';

/**
 * Data Quality Routes
 * Smart Data Quality Checker - AI/ML classification of incidents, risks, controls
 */
export const dataQualityRouter = Router();

// Process records for quality improvement
dataQualityRouter.post('/process', useCaseController.processDataQuality.bind(useCaseController));

// Get data quality dashboard
dataQualityRouter.get('/dashboard', useCaseController.getDataQualityDashboard.bind(useCaseController));

// Health check for data quality service
dataQualityRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Smart Data Quality Checker',
    status: 'healthy',
    features: ['AI Classification', 'Rule-based Fallback', 'Confidence Scoring', 'Human Review Workflow'],
    capabilities: ['Incident Analysis', 'Risk Classification', 'Control Assessment'],
    aiIntegration: {
      openaiAvailable: !!process.env.OPENAI_API_KEY,
      fallbackMode: !process.env.OPENAI_API_KEY ? 'rule-based' : 'ai-powered',
      status: 'operational'
    },
    timestamp: new Date()
  });
});

export default dataQualityRouter;