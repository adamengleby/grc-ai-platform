/**
 * API URL utilities for handling development vs production endpoints
 */

/**
 * Get the base URL for backend API calls
 * In development: localhost:3005
 * In production: Azure Container Apps backend
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

  // Force external API calls for cloud hosting to avoid built-in routing
  const isCloudHosted = hostname?.includes('azurestaticapps.net') || hostname?.includes('z8.web.core.windows.net') || hostname?.includes('pages.dev');

  if (isCloudHosted) {
    // ALWAYS use external Cloudflare Worker when on cloud hosting
    const externalUrl = baseUrl || 'https://grc-backend-au.adam-engleby.workers.dev/api/v1';
    console.log('📍 Cloud hosting detected - using Cloudflare Worker:', externalUrl);
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

  // Fallback to Container Apps backend
  const fallbackUrl = 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1';
  console.log('📍 Using fallback Container Apps backend URL:', fallbackUrl);
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