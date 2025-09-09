/**
 * Local Development Analytics Service
 * Extends existing service with gradual real-data integration
 */

import { AnalyticsService } from './analyticsService';
import { 
  RealTimeMetrics, 
  RiskAnalytics, 
  ComplianceAnalytics, 
  ControlAnalytics,
  PredictiveInsights,
  EventStream,
  AnalyticsTimeRange,
  MLModel
} from '../types';

export class LocalAnalyticsService extends AnalyticsService {
  private useLocalBackend: boolean;
  private fallbackToMock: boolean;

  constructor() {
    super();
    
    // Local development configuration
    this.useLocalBackend = import.meta.env.VITE_USE_LOCAL_BACKEND === 'true';
    this.fallbackToMock = import.meta.env.VITE_FALLBACK_TO_MOCK !== 'false';
    
    // Override base URL for local development
    if (this.useLocalBackend) {
      (this as any).baseUrl = 'http://localhost:3005/api/v1';
    }
    
    console.log('LocalAnalyticsService initialized:', {
      useLocalBackend: this.useLocalBackend,
      fallbackToMock: this.fallbackToMock,
      baseUrl: (this as any).baseUrl
    });
  }

  /**
   * Enhanced getRealTimeMetrics with local backend integration
   */
  async getRealTimeMetrics(tenantId: string): Promise<RealTimeMetrics> {
    if (!this.useLocalBackend) {
      // Use original mock implementation
      return super.getRealTimeMetrics(tenantId);
    }

    try {
      const response = await fetch(`${(this as any).baseUrl}/analytics/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-source': 'local-dev'
        }
      });

      if (!response.ok) {
        throw new Error(`Local backend error: ${response.status}`);
      }

      const result = await response.json();
      
      // Log data source for debugging
      if (result.source) {
        console.log(`📊 Metrics data source: ${result.source}`);
      }

      return result.data;
      
    } catch (error) {
      console.warn('Local backend unavailable, falling back to mock:', error);
      
      if (this.fallbackToMock) {
        return super.getRealTimeMetrics(tenantId);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced getRiskAnalytics with caching awareness
   */
  async getRiskAnalytics(tenantId: string, timeRange: AnalyticsTimeRange): Promise<RiskAnalytics> {
    if (!this.useLocalBackend) {
      return super.getRiskAnalytics(tenantId, timeRange);
    }

    try {
      const params = new URLSearchParams({
        timeRange: timeRange.label || '30d'
      });

      const response = await fetch(`${(this as any).baseUrl}/analytics/risk?${params}`, {
        headers: {
          'x-tenant-id': tenantId,
          'x-source': 'local-dev'
        }
      });

      if (!response.ok) {
        throw new Error(`Risk analytics error: ${response.status}`);
      }

      const result = await response.json();
      
      // Show cache status in development
      if (result.cached) {
        console.log('📈 Using cached risk analytics data');
      }

      return result.data;

    } catch (error) {
      console.warn('Risk analytics error, using fallback:', error);
      
      if (this.fallbackToMock) {
        return super.getRiskAnalytics(tenantId, timeRange);
      }
      
      throw error;
    }
  }

  /**
   * New: Get ML Model Status (local development feature)
   */
  async getMLModels(tenantId: string): Promise<MLModel[]> {
    if (!this.useLocalBackend) {
      return super.getMLModels(tenantId);
    }

    try {
      const response = await fetch(`${(this as any).baseUrl}/analytics/models`, {
        headers: {
          'x-tenant-id': tenantId,
          'x-source': 'local-dev'
        }
      });

      if (!response.ok) {
        throw new Error(`ML models error: ${response.status}`);
      }

      const result = await response.json();
      return result.data;

    } catch (error) {
      console.warn('ML models error, using fallback:', error);
      
      if (this.fallbackToMock) {
        return super.getMLModels(tenantId);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced event streaming with local WebSocket support
   */
  subscribeToEvents(
    tenantId: string, 
    eventTypes: string[],
    callback: (event: EventStream) => void
  ): () => void {
    
    if (!this.useLocalBackend) {
      return super.subscribeToEvents(tenantId, eventTypes, callback);
    }

    // Connect to local WebSocket server
    const socketUrl = (this as any).baseUrl.replace('/api/v1', '');
    console.log(`🔌 Connecting to local WebSocket: ${socketUrl}`);
    
    // Use parent class implementation but with local URL
    const originalBaseUrl = (this as any).baseUrl;
    (this as any).baseUrl = socketUrl + '/api/v1';
    
    const unsubscribe = super.subscribeToEvents(tenantId, eventTypes, (event) => {
      console.log(`📡 Received event: ${event.eventType}`, event);
      callback(event);
    });
    
    // Restore original baseUrl
    (this as any).baseUrl = originalBaseUrl;
    
    return unsubscribe;
  }

  /**
   * Development utility: Check backend connectivity
   */
  async checkBackendHealth(): Promise<{
    localBackend: boolean;
    archerConnectivity: boolean;
    mlService: boolean;
  }> {
    const health = {
      localBackend: false,
      archerConnectivity: false,
      mlService: false
    };

    if (!this.useLocalBackend) {
      return health;
    }

    try {
      // Check local backend
      const response = await fetch(`${(this as any).baseUrl}/health`, {
        timeout: 5000
      } as any);
      
      if (response.ok) {
        const result = await response.json();
        health.localBackend = true;
        health.archerConnectivity = result.archer?.status === 'healthy';
        health.mlService = result.ml?.status === 'healthy';
      }
      
    } catch (error) {
      console.warn('Backend health check failed:', error);
    }

    return health;
  }

  /**
   * Development utility: Toggle data sources
   */
  async toggleDataSource(source: 'mock' | 'local' | 'archer'): Promise<void> {
    if (!this.useLocalBackend) {
      console.warn('Data source toggle only available with local backend');
      return;
    }

    try {
      await fetch(`${(this as any).baseUrl}/dev/data-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source })
      });
      
      console.log(`🔄 Switched data source to: ${source}`);
      
    } catch (error) {
      console.error('Failed to toggle data source:', error);
    }
  }
}

// Export singleton instance for local development
export const localAnalyticsService = new LocalAnalyticsService();

// Development helper: Add to window for debugging
if (import.meta.env.DEV) {
  (window as any).analyticsService = localAnalyticsService;
  
  // Auto-check backend health on load
  localAnalyticsService.checkBackendHealth().then(health => {
    console.log('🏥 Backend Health Check:', health);
  });
}