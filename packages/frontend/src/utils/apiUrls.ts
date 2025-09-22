/**
 * API URL utilities for handling development vs production endpoints
 */

/**
 * Get the base URL for backend API calls
 * In development: localhost:3005
 * In production: Azure Functions backend
 */
export const getBackendApiUrl = (): string => {
  const isDev = import.meta.env.DEV;
  const mode = import.meta.env.MODE;
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  // Debug logging to help diagnose URL issues
  console.log('🔍 Environment Detection:', {
    isDev,
    mode,
    baseUrl,
    hostname: window?.location?.hostname
  });

  // Force production mode for Azure Static Web Apps domains
  const isAzureStaticWebApps = window?.location?.hostname?.includes('azurestaticapps.net');

  if (isDev && !isAzureStaticWebApps) {
    console.log('📍 Using development API URL');
    return 'http://localhost:3005/api/v1';
  }

  // In production or on Azure Static Web Apps, use the Azure Functions backend
  const productionUrl = baseUrl || 'https://func-grc-backend-prod.azurewebsites.net/api/v1';
  console.log('📍 Using production API URL:', productionUrl);
  return productionUrl;
};

/**
 * Get the base URL for MCP server
 * In development: localhost:3006
 * In production: Azure Container Instance
 */
export const getMcpServerUrl = (): string => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3006';
  }

  // In production, use the Azure Container Instance
  return import.meta.env.VITE_MCP_SERVER_URL || 'https://grc-mcp-server-prod.eastus.azurecontainer.io:3006';
};

/**
 * Build a full API URL for backend endpoints
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getBackendApiUrl();
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
};