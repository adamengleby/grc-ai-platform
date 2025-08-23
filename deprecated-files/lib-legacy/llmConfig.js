/**
 * LLM Configuration Helper
 * Provides easy configuration for different LLM providers
 */

const LLM_PROVIDERS = {
  CLAUDE: 'claude',
  OPENAI: 'openai',
  AZURE: 'azure',
  OLLAMA: 'ollama'
};

const DEFAULT_MODELS = {
  [LLM_PROVIDERS.CLAUDE]: 'claude-3-sonnet-20240229',
  [LLM_PROVIDERS.OPENAI]: 'gpt-4',
  [LLM_PROVIDERS.AZURE]: 'gpt-4',
  [LLM_PROVIDERS.OLLAMA]: 'llama3.1:8b'
};

// Popular Ollama models for GRC analysis
const OLLAMA_MODELS = {
  // General purpose models
  LLAMA2: 'llama2',
  LLAMA2_13B: 'llama2:13b',
  LLAMA2_70B: 'llama2:70b',
  
  // Code and analysis focused
  CODELLAMA: 'codellama',
  CODELLAMA_13B: 'codellama:13b',
  
  // Instruction following
  MISTRAL: 'mistral',
  MISTRAL_7B: 'mistral:7b-instruct',
  
  // Larger context models
  NEURAL_CHAT: 'neural-chat',
  ORCA_MINI: 'orca-mini',
  
  // Specialized models
  VICUNA: 'vicuna',
  ALPACA: 'alpaca'
};

/**
 * Get configuration for Claude API
 */
function getClaudeConfig(options = {}) {
  return {
    provider: LLM_PROVIDERS.CLAUDE,
    apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    model: options.model || DEFAULT_MODELS.claude,
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.3,
    timeout: options.timeout || 30000
  };
}

/**
 * Get configuration for OpenAI API
 */
function getOpenAIConfig(options = {}) {
  return {
    provider: LLM_PROVIDERS.OPENAI,
    apiKey: options.apiKey || process.env.OPENAI_API_KEY,
    model: options.model || DEFAULT_MODELS.openai,
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.3,
    timeout: options.timeout || 30000
  };
}

/**
 * Get configuration for Azure OpenAI Service
 */
function getAzureConfig(options = {}) {
  return {
    provider: LLM_PROVIDERS.AZURE,
    apiKey: options.apiKey || process.env.AZURE_OPENAI_API_KEY,
    model: options.model || DEFAULT_MODELS.azure,
    azureEndpoint: options.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT,
    azureApiVersion: options.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    azureDeployment: options.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT,
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.3,
    timeout: options.timeout || 30000
  };
}

/**
 * Get configuration for local Ollama
 */
function getOllamaConfig(options = {}) {
  return {
    provider: LLM_PROVIDERS.OLLAMA,
    model: options.model || DEFAULT_MODELS.ollama,
    ollamaUrl: options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.3,
    timeout: options.timeout || 60000, // Longer timeout for local inference
    fallbackToMock: options.fallbackToMock !== false
  };
}

/**
 * Auto-detect best available provider
 */
async function detectAvailableProvider() {
  const providers = [];

  // Check for API keys - Azure gets priority for enterprise hosting
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    providers.push({
      provider: LLM_PROVIDERS.AZURE,
      config: getAzureConfig(),
      priority: 1
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      provider: LLM_PROVIDERS.CLAUDE,
      config: getClaudeConfig(),
      priority: 2
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      provider: LLM_PROVIDERS.OPENAI,
      config: getOpenAIConfig(),
      priority: 3
    });
  }

  // Check if Ollama is running locally
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      const availableModels = data.models?.map(m => m.name) || [];
      
      providers.push({
        provider: LLM_PROVIDERS.OLLAMA,
        config: getOllamaConfig(),
        priority: 4,
        availableModels
      });
    }
  } catch (error) {
    // Ollama not available
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

/**
 * Get recommended model for GRC analysis by provider
 */
function getGRCRecommendedModel(provider) {
  switch (provider) {
    case LLM_PROVIDERS.CLAUDE:
      return 'claude-3-sonnet-20240229'; // Best for reasoning and analysis
    
    case LLM_PROVIDERS.OPENAI:
      return 'gpt-4'; // Good general purpose
    
    case LLM_PROVIDERS.AZURE:
      return 'gpt-4'; // Enterprise-grade with compliance
    
    case LLM_PROVIDERS.OLLAMA:
      return 'llama3.1:8b'; // Good instruction following for local use
    
    default:
      return DEFAULT_MODELS[provider];
  }
}

/**
 * Create optimized config for GRC workloads
 */
function createGRCConfig(provider, options = {}) {
  const baseConfig = {
    temperature: 0.2, // Lower temperature for more consistent analysis
    maxTokens: 6000,  // Longer responses for detailed insights
    timeout: 45000,   // Longer timeout for complex analysis
    ...options
  };

  switch (provider) {
    case LLM_PROVIDERS.CLAUDE:
      return getClaudeConfig({
        ...baseConfig,
        model: getGRCRecommendedModel(provider)
      });
    
    case LLM_PROVIDERS.OPENAI:
      return getOpenAIConfig({
        ...baseConfig,
        model: getGRCRecommendedModel(provider)
      });
    
    case LLM_PROVIDERS.AZURE:
      return getAzureConfig({
        ...baseConfig,
        model: getGRCRecommendedModel(provider)
      });
    
    case LLM_PROVIDERS.OLLAMA:
      return getOllamaConfig({
        ...baseConfig,
        model: getGRCRecommendedModel(provider),
        timeout: 90000 // Even longer for local inference
      });
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export {
  LLM_PROVIDERS,
  DEFAULT_MODELS,
  OLLAMA_MODELS,
  getClaudeConfig,
  getOpenAIConfig,
  getAzureConfig,
  getOllamaConfig,
  detectAvailableProvider,
  getGRCRecommendedModel,
  createGRCConfig
};