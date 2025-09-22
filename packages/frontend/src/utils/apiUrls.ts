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
  const hostname = window?.location?.hostname;

  // Debug logging to help diagnose URL issues
  console.log('🔍 Environment Detection:', {
    isDev,
    mode,
    baseUrl,
    hostname,
    'import.meta.env': import.meta.env
  });

  // Force external API calls for Azure Static Web Apps to avoid built-in routing
  const isAzureStaticWebApps = hostname?.includes('azurestaticapps.net');

  if (isAzureStaticWebApps) {
    // ALWAYS use external Azure Functions when on Azure Static Web Apps
    const externalUrl = baseUrl || 'https://func-grc-backend-prod.azurewebsites.net/api/v1';
    console.log('📍 Azure Static Web Apps detected - using external API:', externalUrl);
    return externalUrl;
  }

  // Always use the build-time configured API URL if available
  if (baseUrl) {
    console.log('📍 Using configured API URL from VITE_API_BASE_URL:', baseUrl);
    return baseUrl;
  }

  if (isDev) {
    console.log('📍 Using development API URL');
    return 'http://localhost:3005/api/v1';
  }

  // Fallback to Azure Functions backend
  const fallbackUrl = 'https://func-grc-backend-prod.azurewebsites.net/api/v1';
  console.log('📍 Using fallback production API URL:', fallbackUrl);
  return fallbackUrl;
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