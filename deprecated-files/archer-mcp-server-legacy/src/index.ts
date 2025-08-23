#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { PrivacyProtector, defaultPrivacyProtector } from './privacy-protector.js';

// Load environment variables
dotenv.config();

// NEW: Data transformation interfaces
interface FieldMapping {
  [alias: string]: string;
}

interface TransformationOptions {
  includeEmptyFields?: boolean;
  formatValues?: boolean;
  viewType?: 'summary' | 'detailed' | 'full';
  priorityFields?: string[];
}

interface TransformedRecord {
  [displayName: string]: any;
}

interface DataQualityAnalysis {
  totalRecords: number;
  totalFields: number;
  fieldsAnalyzed: number;
  populatedFields: number;
  emptyFields: number;
  populationRate: number;
  averagePopulationRate: number;
  fieldStats: { [alias: string]: FieldStats };
  topPopulatedFields: TopField[];
  emptyFieldsList: { alias: string; displayName: string }[];
}

interface FieldStats {
  displayName: string;
  populatedCount: number;
  totalValues: number;
  populationRate: number;
  isEmpty: boolean;
}

interface TopField {
  alias: string;
  displayName: string;
  value: number;
}

// NEW: Security Events interfaces
interface SecurityEventRequest {
  InstanceName: string;
  EventType: string;
  EventsForDate: string;
}

interface SecurityEvent {
  Event: string;
  InitiatingUser: string;
  Timestamp: string;
  EventDetails: string;
}

// NEW: Universal Data Transformer Class
class ArcherDataTransformer {
  private fieldMappingCache: Map<string, FieldMapping> = new Map();

  // Field type patterns for smart formatting
  private fieldTypePatterns = {
    financial: /amount|loss|cost|price|budget|revenue|financial/i,
    date: /date|time|created|updated|due|start|end|close/i,
    html: /description|comments|notes|summary_|rationale/i,
    email: /email|mail/i,
    phone: /phone|tel|mobile/i,
    percentage: /percent|%|rate_/i,
    boolean: /^(is_|has_|was_|will_|can_|should_)/i,
    count: /count|total|number/i
  };

  constructor(private archerClient: ArcherAPIClient) {}

  /**
   * Get field mapping for any Archer application
   */
  async getFieldMapping(applicationName: string): Promise<FieldMapping> {
    // Check cache first
    if (this.fieldMappingCache.has(applicationName)) {
      console.error(`📋 Using cached field mapping for ${applicationName}`);
      return this.fieldMappingCache.get(applicationName)!;
    }

    try {
      console.error(`🔍 Getting field mapping for ${applicationName}...`);
      
      const fieldInfo = await this.archerClient.getApplicationFields(applicationName);
      const mapping: FieldMapping = {};
      
      if (fieldInfo && fieldInfo.fields) {
        fieldInfo.fields.forEach((field: any) => {
          if (field.alias && field.name) {
            mapping[field.alias] = field.name;
          }
        });
      }

      // Cache the mapping
      this.fieldMappingCache.set(applicationName, mapping);
      console.error(`✅ Cached ${Object.keys(mapping).length} field mappings for ${applicationName}`);
      
      return mapping;

    } catch (error: any) {
      console.error(`⚠️ Could not get field mapping for ${applicationName}: ${error.message}`);
      return {};
    }
  }

  /**
   * Transform records from aliases to display names
   */
  transformRecords(rawRecords: any[], fieldMapping: FieldMapping, options: TransformationOptions = {}): TransformedRecord[] {
    const {
      includeEmptyFields = false,
      formatValues = true,
      priorityFields = []
    } = options;

    // Validate inputs
    if (!Array.isArray(rawRecords)) {
      console.warn('⚠️ rawRecords is not an array in transformRecords, returning empty array');
      return [];
    }
    
    if (!fieldMapping || typeof fieldMapping !== 'object') {
      console.warn('⚠️ fieldMapping is invalid in transformRecords, returning raw records with minimal processing');
      return rawRecords.map(record => ({ ...record }));
    }

    return rawRecords.map(record => {
      const transformedRecord: TransformedRecord = {};

      // Determine which fields to process
      const fieldsToProcess = priorityFields.length > 0 ? priorityFields : Object.keys(record);

      fieldsToProcess.forEach(alias => {
        if (!record.hasOwnProperty(alias)) return;

        const value = record[alias];

        // Skip empty fields if not requested
        if (!includeEmptyFields && !this.hasContent(value)) {
          return;
        }

        // Get display name
        const displayName = fieldMapping[alias] || alias;

        // Format value if requested
        const formattedValue = formatValues ? 
          this.formatFieldValue(alias, value) : value;

        transformedRecord[displayName] = formattedValue;
      });

      return transformedRecord;
    });
  }

  /**
   * Format field value based on type patterns
   */
  formatFieldValue(alias: string, value: any): any {
    if (!this.hasContent(value)) return value;

    // Handle arrays (common in Archer)
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      if (value.length === 1) return this.formatSingleValue(alias, value[0]);
      return value.map(v => this.formatSingleValue(alias, v)).join(', ');
    }

    return this.formatSingleValue(alias, value);
  }

  /**
   * Format a single value based on field type
   */
  private formatSingleValue(alias: string, value: any): any {
    if (!this.hasContent(value)) return value;

    const lowerAlias = alias.toLowerCase();

    // Financial amounts
    if (this.fieldTypePatterns.financial.test(lowerAlias) && typeof value === 'number') {
      return `$${value.toLocaleString()}`;
    }

    // Dates and times
    if (this.fieldTypePatterns.date.test(lowerAlias) && typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return lowerAlias.includes('time') ? 
            date.toLocaleString() : date.toLocaleDateString();
        }
      } catch (e) {
        // Not a valid date, return as-is
      }
    }

    // HTML content - strip tags but preserve meaning
    if (this.fieldTypePatterns.html.test(lowerAlias) && typeof value === 'string') {
      return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    // Percentages
    if (this.fieldTypePatterns.percentage.test(lowerAlias) && typeof value === 'number') {
      return `${value}%`;
    }

    // Boolean fields
    if (this.fieldTypePatterns.boolean.test(lowerAlias)) {
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (['yes', 'true', '1', 'y'].includes(lower)) return 'Yes';
        if (['no', 'false', '0', 'n'].includes(lower)) return 'No';
      }
    }

    // Count fields
    if (this.fieldTypePatterns.count.test(lowerAlias) && typeof value === 'number') {
      return value.toLocaleString();
    }

    return value;
  }

  /**
   * Check if a value has meaningful content
   */
  hasContent(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value).length === 0) return false;
    return true;
  }

  /**
   * Analyze data quality across all records
   */
  analyzeDataQuality(rawRecords: any[], fieldMapping: FieldMapping): DataQualityAnalysis {
    // Validate inputs
    if (!Array.isArray(rawRecords)) {
      console.warn('⚠️ rawRecords is not an array, returning empty analysis');
      return {
        totalRecords: 0,
        totalFields: 0,
        fieldsAnalyzed: 0,
        populatedFields: 0,
        emptyFields: 0,
        populationRate: 0,
        averagePopulationRate: 0,
        fieldStats: {},
        topPopulatedFields: [],
        emptyFieldsList: []
      };
    }
    
    if (!fieldMapping || typeof fieldMapping !== 'object') {
      console.warn('⚠️ fieldMapping is invalid, returning basic analysis');
      return {
        totalRecords: rawRecords.length,
        totalFields: 0,
        fieldsAnalyzed: 0,
        populatedFields: 0,
        emptyFields: 0,
        populationRate: 0,
        averagePopulationRate: 0,
        fieldStats: {},
        topPopulatedFields: [],
        emptyFieldsList: []
      };
    }

    const totalRecords = rawRecords.length;
    const fieldStats: { [alias: string]: FieldStats } = {};
    const populatedFields = new Set<string>();
    const emptyFields = new Set<string>();

    // Analyze each field across all records
    Object.keys(fieldMapping).forEach(alias => {
      let populatedCount = 0;
      let totalValues = 0;

      rawRecords.forEach(record => {
        if (record.hasOwnProperty(alias)) {
          totalValues++;
          if (this.hasContent(record[alias])) {
            populatedCount++;
            populatedFields.add(alias);
          }
        }
      });

      const populationRate = totalValues > 0 ? (populatedCount / totalValues) * 100 : 0;
      
      fieldStats[alias] = {
        displayName: fieldMapping[alias],
        populatedCount,
        totalValues,
        populationRate: Math.round(populationRate * 100) / 100,
        isEmpty: populatedCount === 0
      };

      if (populatedCount === 0) {
        emptyFields.add(alias);
      }
    });

    return {
      totalRecords,
      totalFields: Object.keys(fieldMapping).length,
      fieldsAnalyzed: Object.keys(fieldMapping).length,
      populatedFields: populatedFields.size,
      emptyFields: emptyFields.size,
      populationRate: Math.round((populatedFields.size / Object.keys(fieldMapping).length) * 100),
      averagePopulationRate: Math.round((populatedFields.size / Object.keys(fieldMapping).length) * 100),
      fieldStats,
      topPopulatedFields: this.getTopFields(fieldStats, 'populationRate', 10),
      emptyFieldsList: Array.from(emptyFields).map(alias => ({
        alias,
        displayName: fieldMapping[alias]
      }))
    };
  }

  /**
   * Get top fields by specified metric
   */
  private getTopFields(fieldStats: { [alias: string]: FieldStats }, metric: keyof FieldStats, limit: number = 10): TopField[] {
    return Object.entries(fieldStats)
      .sort(([,a], [,b]) => (b[metric] as number) - (a[metric] as number))
      .slice(0, limit)
      .map(([alias, stats]) => ({
        alias,
        displayName: stats.displayName,
        value: stats[metric] as number
      }));
  }

  /**
   * Generate a comprehensive data summary with transformations
   */
  async generateDataSummary(applicationName: string, rawRecords: any[], options: TransformationOptions = {}): Promise<string> {
    try {
      const fieldMapping = await this.getFieldMapping(applicationName);
      const transformedRecords = this.transformRecords(rawRecords, fieldMapping, options);
      const analysis = this.analyzeDataQuality(rawRecords, fieldMapping);

      let summary = `=== ${applicationName} - Data Summary with Field Transformations ===\n\n`;
      
      // Data Quality Overview
      summary += `Data Quality Analysis:\n`;
      summary += `📊 Total Records: ${analysis.totalRecords.toLocaleString()}\n`;
      summary += `📋 Total Fields: ${analysis.totalFields}\n`;
      summary += `✅ Populated Fields: ${analysis.populatedFields} (${analysis.populationRate}%)\n`;
      summary += `❌ Empty Fields: ${analysis.emptyFields}\n\n`;

      // Top Populated Fields
      if (analysis.topPopulatedFields.length > 0) {
        summary += `🏆 Top Populated Fields:\n`;
        analysis.topPopulatedFields.slice(0, 5).forEach((field, index) => {
          summary += `${index + 1}. ${field.displayName} (${field.value}% populated)\n`;
        });
        summary += '\n';
      }

      // Sample Transformed Data
      if (transformedRecords.length > 0) {
        summary += `📝 Sample Transformed Records (Showing first 3):\n`;
        transformedRecords.slice(0, 3).forEach((record, index) => {
          summary += `\n${index + 1}. Record:\n`;
          
          const keys = Object.keys(record);
          const priorityKeys = keys.filter(key => 
            key.toLowerCase().includes('id') || 
            key.toLowerCase().includes('name') || 
            key.toLowerCase().includes('title')
          ).slice(0, 3);
          
          const otherKeys = keys.filter(key => 
            !priorityKeys.includes(key)
          ).slice(0, 4);

          [...priorityKeys, ...otherKeys].forEach(key => {
            let value = record[key];
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            summary += `   ${key}: ${value}\n`;
          });

          if (keys.length > 7) {
            summary += `   ... and ${keys.length - 7} more fields\n`;
          }
        });
      }

      // Field Mapping Examples
      const mappingExamples = Object.entries(fieldMapping).slice(0, 10);
      if (mappingExamples.length > 0) {
        summary += `\n🔄 Field Transformation Examples:\n`;
        mappingExamples.forEach(([alias, displayName]) => {
          summary += `• ${alias} → "${displayName}"\n`;
        });
      }

      return summary;

    } catch (error: any) {
      return `Error generating data summary: ${error.message}`;
    }
  }
}

// Archer configuration interface
interface ArcherConfig {
  baseUrl: string;
  instanceName: string;
  username: string;
  password: string;
}

// Archer session interface
interface ArcherSession {
  sessionToken: string;
  expiresAt: Date;
}

// Application interface based on documentation
interface ArcherApplication {
  Id: number;
  Name: string;
  Alias?: string;
  Guid: string;
  Status: number;
  LevelId?: number; // NEW: Store the Level ID
  ValidatedUrl?: string; // Store validated contentapi URL
}

// NEW: Questionnaire interface for /api/core/system/questionnaire
interface ArcherQuestionnaire {
  Id: number;
  Name: string;
  Alias?: string;
  Guid: string;
  Status: number;
  TargetLevelId?: number; // Questionnaires use TargetLevelId instead of LevelId
  ValidatedUrl?: string;
}


// NEW: Level interface for /api/core/system/level
interface ArcherLevel {
  Id: number;
  Guid: string;
  ModuleId: number;
  ModuleName: string;
  Name: string;
  Alias: string;
  Description?: string;
  AllowFilter: boolean;
  ASOStatus: number;
  IsDeleted: boolean;
  IsAllowAddNew: boolean;
  IsAllowCopy: boolean;
}

// Field interface for module fields
interface ArcherField {
  Id: number;
  Name: string;
  Alias: string;
  Type: number;
  IsActive: boolean;
  IsCalculated: boolean;
  IsRequired?: boolean;
  Guid: string;
  [key: string]: any;
}

// Level mapping interface
interface LevelMapping {
  levelId: number;
  alias: string;
  moduleName: string;
  moduleId: number;
}

class ArcherAPIClient {
  private config: ArcherConfig;
  private session: ArcherSession | null = null;
  private axiosInstance: AxiosInstance;
  private applicationCache: ArcherApplication[] = [];
  private fieldCache: Map<number, ArcherField[]> = new Map();
  private levelCache: LevelMapping[] = []; // NEW: Cache for level mappings
  public dataTransformer: ArcherDataTransformer; // NEW: Data transformer
  public privacyProtector: PrivacyProtector; // NEW: Privacy protection

  constructor(config: ArcherConfig) {
    this.config = config;
    
    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Ignore SSL certificate errors for development (remove in production!)
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    // Initialize data transformer
    this.dataTransformer = new ArcherDataTransformer(this);
    
    // Initialize privacy protector with environment-based config
    this.privacyProtector = new PrivacyProtector({
      enableMasking: process.env.ENABLE_PRIVACY_MASKING !== 'false',
      maskingLevel: (process.env.MASKING_LEVEL as any) || 'moderate',
      enableTokenization: process.env.ENABLE_TOKENIZATION === 'true',
      preserveStructure: true,
      customSensitiveFields: process.env.CUSTOM_SENSITIVE_FIELDS?.split(',') || []
    });
  }

  // Login to Archer and get session token
  async login(): Promise<string> {
    try {
      console.error('=== ARCHER LOGIN ATTEMPT ===');
      console.error('Base URL:', this.config.baseUrl);
      
      const loginData = {
        InstanceName: this.config.instanceName,
        Username: this.config.username,
        UserDomain: '',
        Password: this.config.password
      };

      const response = await this.axiosInstance.post('/api/core/security/login', loginData);
      
      if (response.data.IsSuccessful && response.data.RequestedObject?.SessionToken) {
        this.session = {
          sessionToken: response.data.RequestedObject.SessionToken,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000) // 20 minutes
        };
        
        // Set the session token for future requests
        this.axiosInstance.defaults.headers.common['Authorization'] = 
          `Archer session-id=${this.session.sessionToken}`;
        
        console.error('✅ Successfully logged in to Archer');
        console.error('Session Token (first 20 chars):', this.session.sessionToken.substring(0, 20));
        return this.session.sessionToken;
      } else {
        const errorMessages = response.data.ValidationMessages?.map((msg: any) => 
          msg.MessageKey || msg.Description || 'Unknown error'
        ).join(', ') || 'Unknown error';
        throw new Error(`Login failed: ${errorMessages}`);
      }
    } catch (error: any) {
      console.error('=== LOGIN ERROR ===');
      console.error('Error message:', error.message);
      
      if (error.response) {
        console.error('HTTP Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw error;
    }
  }

  // Check if session is valid
  isSessionValid(): boolean {
    return !!(this.session && this.session.expiresAt > new Date());
  }

  // Ensure we have a valid session
  async ensureValidSession(): Promise<void> {
    if (!this.isSessionValid()) {
      console.error('🔄 Session invalid, logging in...');
      await this.login();
    } else {
      console.error('✅ Session is valid');
    }
  }

  // NEW: Get and cache Level mappings using /api/core/system/level
  async getLevelMappings(): Promise<LevelMapping[]> {
    if (this.levelCache.length > 0) {
      console.error(`📋 Returning cached Level mappings (${this.levelCache.length} entries)`);
      return this.levelCache;
    }

    await this.ensureValidSession();
    
    try {
      console.error('🔍 Fetching Level mappings from /api/core/system/level...');
      
      const response = await this.axiosInstance.get('/api/core/system/level', {
        headers: {
          'Authorization': `Archer session-id=${this.session?.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const mappings: LevelMapping[] = [];

      if (Array.isArray(response.data)) {
        response.data.forEach((item: any) => {
          if (item.RequestedObject && !item.RequestedObject.IsDeleted) {
            const level = item.RequestedObject;
            mappings.push({
              levelId: level.Id,
              alias: level.Alias,
              moduleName: level.ModuleName,
              moduleId: level.ModuleId
            });
            console.error(`✅ Level ${level.Id}: ${level.ModuleName} → /contentapi/${level.Alias}`);
          }
        });
      }

      this.levelCache = mappings;
      console.error(`✅ Cached ${mappings.length} Level mappings`);
      
      return mappings;
    } catch (error: any) {
      console.error('❌ Error fetching Level mappings:', error.message);
      return [];
    }
  }

  // NEW: Get ContentAPI URL for a given Level ID
  async getContentApiUrlForLevel(levelId: number): Promise<string | null> {
    const mappings = await this.getLevelMappings();
    const mapping = mappings.find(m => m.levelId === levelId);
    
    if (mapping) {
      const url = `/contentapi/${mapping.alias}`;
      console.error(`✅ Level ${levelId} → ${url}`);
      return url;
    }
    
    console.error(`❌ No mapping found for Level ID: ${levelId}`);
    return null;
  }

  // NEW: Find Level mapping by module name or alias
  async findLevelMapping(nameOrAlias: string): Promise<LevelMapping | null> {
    const mappings = await this.getLevelMappings();
    
    // Try exact match first
    let mapping = mappings.find(m => 
      m.moduleName.toLowerCase() === nameOrAlias.toLowerCase() ||
      m.alias.toLowerCase() === nameOrAlias.toLowerCase()
    );
    
    if (!mapping) {
      // Try partial match
      mapping = mappings.find(m => 
        m.moduleName.toLowerCase().includes(nameOrAlias.toLowerCase()) ||
        m.alias.toLowerCase().includes(nameOrAlias.toLowerCase()) ||
        nameOrAlias.toLowerCase().includes(m.moduleName.toLowerCase()) ||
        nameOrAlias.toLowerCase().includes(m.alias.toLowerCase())
      );
    }
    
    return mapping || null;
  }

  // Debug method to inspect raw API responses
  async debugApiCall(endpoint: string): Promise<any> {
    await this.ensureValidSession();
    
    let debugInfo = {
      endpoint: endpoint,
      baseUrl: this.config.baseUrl,
      fullUrl: `${this.config.baseUrl}/${endpoint}`,
      sessionValid: this.isSessionValid(),
      sessionToken: this.session?.sessionToken?.substring(0, 20) + '...',
      timestamp: new Date().toISOString(),
      success: false,
      statusCode: null as number | null,
      error: null as any,
      responseKeys: [] as string[],
      moduleRowsCount: 0,
      sampleData: null as any
    };
    
    try {
      console.error(`🔧 DEBUG: Making API call to ${endpoint}`);
      
      const response = await this.axiosInstance.get(`/${endpoint}`, {
        headers: {
          'Authorization': `Archer session-id=${this.session?.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      debugInfo.success = true;
      debugInfo.statusCode = response.status;
      debugInfo.responseKeys = Object.keys(response.data || {});
      
      console.error(`✅ DEBUG: API call successful, status ${response.status}`);
      console.error(`📊 DEBUG: Response keys: ${debugInfo.responseKeys.join(', ')}`);
      
      // Handle different response formats
      if (response.data && Array.isArray(response.data)) {
        // Handle array responses (like /api/core/system/level)
        debugInfo.moduleRowsCount = response.data.length;
        debugInfo.sampleData = {
          arrayLength: response.data.length,
          firstFewItems: response.data.slice(0, 5).map((item: any) => {
            if (item.RequestedObject) {
              return {
                Id: item.RequestedObject.Id,
                Name: item.RequestedObject.Name || item.RequestedObject.ModuleName,
                Alias: item.RequestedObject.Alias,
                Status: item.RequestedObject.Status,
                ModuleId: item.RequestedObject.ModuleId
              };
            }
            return item;
          }),
          responseStructure: response.data[0] ? Object.keys(response.data[0]) : []
        };
      } else if (response.data && response.data.value) {
        // Handle OData responses
        debugInfo.moduleRowsCount = response.data.value.length;
        debugInfo.sampleData = {
          odataContext: response.data['@odata.context'],
          valueLength: response.data.value.length,
          firstFewItems: response.data.value.slice(0, 10)
        };
      } else {
        debugInfo.sampleData = {
          fullResponse: response.data
        };
      }
      
      return debugInfo;
      
    } catch (error: any) {
      debugInfo.error = {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      };
      
      console.error(`❌ DEBUG: API call failed - ${error.message}`);
      if (error.response) {
        console.error(`📊 DEBUG: Error status: ${error.response.status}`);
        console.error(`📊 DEBUG: Error response:`, JSON.stringify(error.response.data, null, 2));
      }
      
      return debugInfo;
    }
  }

  // UPDATED: Get list of applications and map them to their Level aliases
  async getApplications(): Promise<ArcherApplication[]> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error('🔍 Fetching applications from /api/core/system/application...');
      
      // First, get all Level mappings
      const levelMappings = await this.getLevelMappings();
      console.error(`📋 Have ${levelMappings.length} Level mappings`);
      
      const applications: ArcherApplication[] = [];
      
      // Get all applications
      const response = await this.axiosInstance.get('/api/core/system/application', {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.error(`📊 Response status: ${response.status}`);
      
      // Parse the response
      if (Array.isArray(response.data)) {
        console.error(`📋 Found ${response.data.length} total applications`);
        
        for (const item of response.data) {
          if (item.RequestedObject) {
            const app = item.RequestedObject;
            
            // Only process ACTIVE applications (Status = 1)
            if (app.Status === 1) {
              console.error(`🔍 Processing active app: ${app.Name} (Level: ${app.LevelId})`);
              
              // Find the corresponding Level mapping
              const levelMapping = levelMappings.find(m => m.moduleId === app.Id);
              
              let validatedUrl: string | undefined;
              let alias: string | undefined;
              
              if (levelMapping) {
                alias = levelMapping.alias;
                validatedUrl = `/contentapi/${levelMapping.alias}`;
                console.error(`✅ Found Level mapping: ${app.Name} → ${validatedUrl}`);
              } else {
                console.error(`⚠️ No Level mapping found for ${app.Name} (App ID: ${app.Id})`);
                
                // Try to find by name match
                const nameMapping = await this.findLevelMapping(app.Name);
                if (nameMapping) {
                  alias = nameMapping.alias;
                  validatedUrl = `/contentapi/${nameMapping.alias}`;
                  console.error(`✅ Found Level mapping by name: ${app.Name} → ${validatedUrl}`);
                }
              }
              
              const application: ArcherApplication = {
                Id: app.Id,
                Name: app.Name,
                Alias: alias || app.Alias,
                Guid: app.Guid,
                Status: app.Status,
                LevelId: app.LevelId,
                ValidatedUrl: validatedUrl
              };
              
              applications.push(application);
              
              console.error(`✅ Added ACTIVE: ${app.Name} (ID: ${app.Id}, Alias: ${alias || 'NOT FOUND'}, URL: ${validatedUrl || 'NOT FOUND'})`);
            } else {
              const statusText = app.Status === 0 ? 'Draft' : app.Status === 3 ? 'Retired' : 'Unknown';
              console.error(`⚠️ Skipping ${statusText}: ${app.Name} (Status: ${app.Status})`);
            }
          }
        }
      } else {
        console.error(`❌ Unexpected response format - not an array`);
        throw new Error('Unexpected response format from /api/core/system/application');
      }
      
      // Remove duplicates based on ID
      const uniqueApplications = applications.filter((app, index, self) => 
        index === self.findIndex(a => a.Id === app.Id)
      );
      
      this.applicationCache = uniqueApplications;
      console.error(`🎯 Cached ${uniqueApplications.length} ACTIVE applications with Level-based URLs`);
      
      return uniqueApplications;
    } catch (error: any) {
      console.error('❌ Error fetching applications:', error.message);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      throw error;
    }
  }

  // NEW: Get list of questionnaires and map them to their Level aliases
  async getQuestionnaires(): Promise<ArcherQuestionnaire[]> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error('🔍 Fetching questionnaires from /api/core/system/questionnaire...');
      
      // First, get all Level mappings
      const levelMappings = await this.getLevelMappings();
      console.error(`📋 Have ${levelMappings.length} Level mappings`);
      
      const questionnaires: ArcherQuestionnaire[] = [];
      
      // Get all questionnaires
      const response = await this.axiosInstance.get('/api/core/system/questionnaire', {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.error(`📊 Response status: ${response.status}`);
      
      // Parse the response
      if (Array.isArray(response.data)) {
        console.error(`📋 Found ${response.data.length} total questionnaires`);
        
        for (const item of response.data) {
          if (item.RequestedObject) {
            const questionnaire = item.RequestedObject;
            
            // Only process ACTIVE questionnaires (Status = 1)
            if (questionnaire.Status === 1) {
              console.error(`🔍 Processing active questionnaire: ${questionnaire.Name} (TargetLevel: ${questionnaire.TargetLevelId})`);
              
              // Find corresponding Level for this questionnaire using TargetLevelId
              const levelMapping = levelMappings.find(level => level.levelId === questionnaire.TargetLevelId);
              
              if (levelMapping) {
                // Construct the URL for this questionnaire
                const questionnaireUrl = `${this.config.baseUrl}/GenericContent/Content.aspx?instanceguid=${questionnaire.Guid}&moduleId=${levelMapping.moduleId}`;
                
                let validatedUrl: string | undefined;
                try {
                  // Try to validate the URL by making a HEAD request
                  await this.axiosInstance.head(questionnaireUrl, {
                    headers: {
                      'Authorization': `Archer session-id=${this.session.sessionToken}`,
                    },
                    timeout: 5000
                  });
                  validatedUrl = questionnaireUrl;
                  console.error(`✅ Validated URL for questionnaire: ${questionnaire.Name}`);
                } catch {
                  console.error(`⚠️ Could not validate URL for questionnaire: ${questionnaire.Name}`);
                  validatedUrl = questionnaireUrl; // Still include it even if validation fails
                }
                
                questionnaires.push({
                  Id: questionnaire.Id,
                  Name: questionnaire.Name,
                  Alias: levelMapping.alias,
                  Guid: questionnaire.Guid,
                  Status: questionnaire.Status,
                  TargetLevelId: questionnaire.TargetLevelId,
                  ValidatedUrl: validatedUrl
                });
                
                console.error(`✅ Added questionnaire: ${questionnaire.Name} with alias "${levelMapping.alias}"`);
              } else {
                console.error(`⚠️ No Level mapping found for questionnaire ${questionnaire.Name} (TargetLevelId: ${questionnaire.TargetLevelId})`);
              }
            } else {
              console.error(`⏭️ Skipping inactive questionnaire: ${questionnaire.Name} (Status: ${questionnaire.Status})`);
            }
          }
        }
      } else if (response.data?.RequestedObject) {
        throw new Error('Unexpected response format from /api/core/system/questionnaire');
      } else {
        console.error('⚠️ Unexpected questionnaire response format:', JSON.stringify(response.data, null, 2).substring(0, 300));
      }
      
      // Remove duplicates based on Id
      const uniqueQuestionnaires = questionnaires.filter((questionnaire, index, self) => 
        index === self.findIndex(q => q.Id === questionnaire.Id)
      );
      
      console.error(`🎯 Found ${uniqueQuestionnaires.length} ACTIVE questionnaires with Level-based URLs`);
      
      return uniqueQuestionnaires;
    } catch (error: any) {
      console.error('❌ Error fetching questionnaires:', error.message);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      throw error;
    }
  }

  // NEW: Get fields for a questionnaire by questionnaire ID or TargetLevelId
  async getQuestionnaireFields(questionnaireIdOrTargetLevelId: number): Promise<ArcherField[]> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Fetching fields for questionnaire/level: ${questionnaireIdOrTargetLevelId}`);
      
      // Try to get fields using the level ID (TargetLevelId from questionnaire)
      const response = await this.axiosInstance.get(`/api/core/system/level/${questionnaireIdOrTargetLevelId}/field`, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.error(`📊 Response status: ${response.status}`);
      
      const fields: ArcherField[] = [];
      
      // Parse the response
      if (Array.isArray(response.data)) {
        console.error(`📋 Found ${response.data.length} total fields`);
        
        for (const item of response.data) {
          if (item.RequestedObject) {
            const field = item.RequestedObject;
            
            // Only process ACTIVE fields
            if (field.IsActive === true) {
              fields.push({
                Id: field.Id,
                Name: field.Name,
                Alias: field.Alias,
                Type: field.Type,
                IsActive: field.IsActive,
                IsCalculated: field.IsCalculated,
                IsRequired: field.IsRequired,
                Guid: field.Guid,
                IsKey: field.IsKey,
                IsContentReadOnly: field.IsContentReadOnly,
                IsPrivate: field.IsPrivate
              });
              
              console.error(`✅ Added field: ${field.Name} (Type: ${field.Type})`);
            } else {
              console.error(`⏭️ Skipping inactive field: ${field.Name}`);
            }
          }
        }
      } else if (response.data?.RequestedObject) {
        // Single field response
        const field = response.data.RequestedObject;
        if (field.IsActive === true) {
          fields.push({
            Id: field.Id,
            Name: field.Name,
            Alias: field.Alias,
            Type: field.Type,
            IsActive: field.IsActive,
            IsCalculated: field.IsCalculated,
            IsRequired: field.IsRequired,
            Guid: field.Guid,
            IsKey: field.IsKey,
            IsContentReadOnly: field.IsContentReadOnly,
            IsPrivate: field.IsPrivate
          });
        }
      } else {
        console.error('⚠️ Unexpected fields response format:', JSON.stringify(response.data, null, 2).substring(0, 300));
      }
      
      console.error(`🎯 Found ${fields.length} ACTIVE fields for level/questionnaire ${questionnaireIdOrTargetLevelId}`);
      
      return fields;
    } catch (error: any) {
      console.error('❌ Error fetching questionnaire fields:', error.message);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      throw error;
    }
  }

  // Get application by name or alias
  async getApplicationByName(appName: string): Promise<ArcherApplication> {
    console.error(`🔍 Looking for application: "${appName}"`);
    console.error(`📋 Cache size before check: ${this.applicationCache.length}`);
    
    if (this.applicationCache.length === 0) {
      console.error('🔄 Application cache empty, fetching applications...');
      await this.getApplications();
    }
    
    let app = this.applicationCache.find((application: ArcherApplication) => {
      const nameMatch = application.Name?.toLowerCase() === appName.toLowerCase();
      const aliasMatch = application.Alias?.toLowerCase() === appName.toLowerCase();
      
      if (nameMatch || aliasMatch) {
        console.error(`✅ Found match: ${application.Name} (${application.Alias}) - URL: ${application.ValidatedUrl}`);
        return true;
      }
      return false;
    });
    
    if (!app) {
      // Try one more time with Level mapping
      console.error(`🔍 Trying to find by Level mapping...`);
      const levelMapping = await this.findLevelMapping(appName);
      
      if (levelMapping) {
        // Find app by module ID
        app = this.applicationCache.find(a => a.Id === levelMapping.moduleId);
        
        if (!app) {
          // Create a synthetic app entry if we have Level mapping but no app
          app = {
            Id: levelMapping.moduleId,
            Name: levelMapping.moduleName,
            Alias: levelMapping.alias,
            Guid: '', // Unknown
            Status: 1, // Assume active
            ValidatedUrl: `/contentapi/${levelMapping.alias}`
          };
          console.error(`✅ Created app from Level mapping: ${app.Name}`);
        }
      }
    }
    
    if (!app) {
      const availableNames = this.applicationCache.map(a => a.Name).slice(0, 10);
      console.error(`❌ Application '${appName}' not found`);
      console.error(`📋 Available ACTIVE applications: ${availableNames.join(', ')}`);
      throw new Error(`Application '${appName}' not found. Available: ${availableNames.join(', ')}`);
    }
    
    return app;
  }

  // Get all ACTIVE fields using the correct endpoint
  async getModuleFields(moduleId: number): Promise<ArcherField[]> {
    await this.ensureValidSession();
    
    // Check cache first
    if (this.fieldCache.has(moduleId)) {
      console.error(`📋 Returning cached ACTIVE fields for module ${moduleId}`);
      return this.fieldCache.get(moduleId)!;
    }
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Getting ACTIVE fields for module ID: ${moduleId}`);
      
      const endpoint = `api/core/system/fielddefinition/application/${moduleId}`;
      
      console.error(`🔗 Using field definition endpoint: ${endpoint}`);
      
      const response = await this.axiosInstance.get(`/${endpoint}`, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.error(`✅ SUCCESS with field definition endpoint: ${endpoint}`);
      
      // Parse fields from response
      const fields: ArcherField[] = [];
      
      if (Array.isArray(response.data)) {
        response.data.forEach((item: any) => {
          const fieldDef = item.RequestedObject;
          if (fieldDef && fieldDef.Id && fieldDef.IsActive) { // ONLY active fields
            fields.push({
              Id: fieldDef.Id,
              Name: fieldDef.Name,
              Alias: fieldDef.Alias,
              Type: fieldDef.Type,
              IsActive: fieldDef.IsActive,
              IsCalculated: fieldDef.IsCalculated || false,
              IsRequired: fieldDef.IsRequired || false,
              Guid: fieldDef.Guid,
              // Include other useful properties
              IsKey: fieldDef.IsKey,
              IsContentReadOnly: fieldDef.IsContentReadOnly,
              IsPrivate: fieldDef.IsPrivate
            });
          }
        });
      }
      
      // Cache the ACTIVE fields only
      this.fieldCache.set(moduleId, fields);
      console.error(`✅ Retrieved and cached ${fields.length} ACTIVE fields for module ${moduleId}`);
      
      return fields;
      
    } catch (error: any) {
      console.error('❌ Error getting module fields:', error.message);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data preview:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      return [];
    }
  }

  // UPDATED: Search records using Level-based URLs with data transformation
  async searchRecords(appName: string, pageSize: number = 100, pageNumber: number = 1, includeFullData: boolean = false): Promise<any> {
    await this.ensureValidSession();
    
    try {
      // Get application details with validated URL
      const app = await this.getApplicationByName(appName);
      
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Searching records in application: ${app.Name} (ID: ${app.Id})`);
      
      // Use the validated URL from Level mapping
      let contentApiUrl = app.ValidatedUrl;
      
      if (!contentApiUrl) {
        throw new Error(`No valid ContentAPI URL found for ${app.Name}. This application may not be exposed via ContentAPI.`);
      }
      
      console.error(`🔗 Using Level-based ContentAPI URL: ${contentApiUrl}`);
      
      // OPTIMIZATION: Smart data fetching based on requirements
      let allRecords: any[] = [];
      let pageRecords: any[] = [];
      let totalCount = 0;
      
      if (includeFullData) {
        // Full data requested - fetch all records
        try {
          allRecords = await this.getAllRecordsAtOnce(contentApiUrl);
        } catch (topAllError: any) {
          console.error(`⚠️ top=all failed, trying pagination: ${topAllError?.message || topAllError}`);
          allRecords = await this.getAllRecordsWithPagination(contentApiUrl);
        }
        totalCount = allRecords.length;
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalCount);
        pageRecords = allRecords.slice(startIndex, endIndex);
        console.error(`🎯 Retrieved ${allRecords.length} total records from ${app.Name} with FULL field data`);
      } else {
        // OPTIMIZATION: Fetch only the requested page
        try {
          const result = await this.getPagedRecords(contentApiUrl, pageSize, pageNumber);
          pageRecords = result.records;
          totalCount = result.totalCount;
          console.error(`🎯 Retrieved page ${pageNumber} (${pageRecords.length} records) from ${app.Name}`);
        } catch (pageError: any) {
          console.error(`⚠️ Paged retrieval failed, falling back to full retrieval: ${pageError?.message || pageError}`);
          // Fallback to full retrieval
          try {
            allRecords = await this.getAllRecordsAtOnce(contentApiUrl);
          } catch (topAllError: any) {
            allRecords = await this.getAllRecordsWithPagination(contentApiUrl);
          }
          totalCount = allRecords.length;
          const startIndex = (pageNumber - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, totalCount);
          pageRecords = allRecords.slice(startIndex, endIndex);
        }
      }
      
      if (pageRecords.length === 0) {
        console.error(`📋 No records found in ${app.Name} for page ${pageNumber}`);
      }
      
      // Get ACTIVE field information for context
      const fields = await this.getModuleFields(app.Id);

      // NEW: Generate data transformation summary
      let transformationSummary = '';
      try {
        // Use all records for summary if includeFullData is true
        const recordsForSummary = includeFullData ? allRecords : pageRecords;
        transformationSummary = await this.dataTransformer.generateDataSummary(app.Name, recordsForSummary, {
          formatValues: true,
          includeEmptyFields: false,
          viewType: includeFullData ? 'detailed' : 'summary'
        });
      } catch (transformError: any) {
        console.error(`⚠️ Data transformation failed: ${transformError.message}`);
        transformationSummary = `Data transformation not available: ${transformError.message}`;
      }
      
      return {
        records: pageRecords,                    // Current page records for display
        allRecords: includeFullData ? allRecords : null, // OPTIMIZATION: Only include when requested
        totalCount: totalCount,
        pageSize: pageSize,
        pageNumber: pageNumber,
        totalPages: Math.ceil(totalCount / pageSize),
        applicationName: app.Name,
        applicationId: app.Id,
        validatedUrl: contentApiUrl,
        fieldCount: fields.length,
        activeFields: fields.slice(0, 10),       // Show first 10 active fields
        transformationSummary: transformationSummary,
        metadata: {
          responseType: 'OData',
          hasMorePages: pageNumber < Math.ceil(totalCount / pageSize),
          recordsPerPage: pageRecords.length,
          dataCompleteness: includeFullData ? 'FULL' : 'PAGINATED',
          allFieldsIncluded: true,
          totalRecordsRetrieved: includeFullData ? allRecords.length : pageRecords.length,
          estimatedTotalSize: totalCount > 1000 ? `~${Math.round(totalCount / 1000)}k records` : `${totalCount} records`,
          retrievalMethod: includeFullData ? 'Level-based URL mapping with full retrieval' : 'Level-based URL mapping with pagination'
        }
      };
      
    } catch (error: any) {
      console.error('❌ Error searching records:', error.message);
      throw error;
    }
  }

  // Get all records with pagination
  async getAllRecordsWithPagination(url: string): Promise<any[]> {
    if (!this.session?.sessionToken) {
      throw new Error('No valid session token');
    }

    let allRecords: any[] = [];
    let skipCount = 0;
    const batchSize = 1000;
    let pageCount = 0;
    const maxPages = 50;

    console.error(`🔄 Starting pagination for URL: ${url}`);

    while (pageCount < maxPages) {
      try {
        pageCount++;
        
        const params: any = { $top: batchSize };
        if (skipCount > 0) {
          params.$skip = skipCount;
        }

        const response: any = await this.axiosInstance.get(url, {
          headers: {
            'Authorization': `Archer session-id=${this.session.sessionToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          params: params,
          timeout: 60000
        });

        let pageRecords: any[] = [];
        
        if (response.data && response.data.value && Array.isArray(response.data.value)) {
          pageRecords = response.data.value;
        } else if (Array.isArray(response.data)) {
          pageRecords = response.data;
        } else {
          console.error(`⚠️ Unexpected response format on batch ${pageCount}`);
          break;
        }

        allRecords = allRecords.concat(pageRecords);
        
        if (pageRecords.length < batchSize) {
          console.error(`🏁 Reached end of dataset (batch ${pageCount} had ${pageRecords.length} records)`);
          break;
        }
        
        skipCount += batchSize;

      } catch (error: any) {
        console.error(`❌ Error on batch ${pageCount}:`, error.response?.status || error.message);
        if (error.response?.status === 404) {
          throw new Error(`ContentAPI endpoint not found: ${url}. This application may not be exposed via ContentAPI.`);
        }
        throw error;
      }
    }

    console.error(`🎯 Completed: Retrieved ${allRecords.length} total records`);
    return allRecords;
  }

  // OPTIMIZATION: Get specific page of records efficiently
  async getPagedRecords(contentApiUrl: string, pageSize: number, pageNumber: number): Promise<{records: any[], totalCount: number}> {
    if (!this.session?.sessionToken) {
      throw new Error('No valid session token');
    }

    try {
      // First, get total count using $count=true with minimal data
      const countUrl = `${contentApiUrl}?$count=true&$top=1`;
      
      const countResponse = await this.axiosInstance.get(countUrl, {
        headers: {
          'Authorization': `Archer session-id="${this.session.sessionToken}"`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      let totalCount = 0;
      if (countResponse.data && typeof countResponse.data['@odata.count'] === 'number') {
        totalCount = countResponse.data['@odata.count'];
      } else if (countResponse.data && Array.isArray(countResponse.data.value)) {
        // Fallback: get all records for count (not ideal but necessary for some systems)
        const allRecords = await this.getAllRecordsAtOnce(contentApiUrl);
        totalCount = allRecords.length;
        
        // Return sliced data if we already have it
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalCount);
        return {
          records: allRecords.slice(startIndex, endIndex),
          totalCount: totalCount
        };
      }

      // Now get the specific page
      const skipCount = (pageNumber - 1) * pageSize;
      const pageUrl = `${contentApiUrl}?$skip=${skipCount}&$top=${pageSize}`;
      
      const response = await this.axiosInstance.get(pageUrl, {
        headers: {
          'Authorization': `Archer session-id="${this.session.sessionToken}"`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      let records: any[] = [];
      if (response.data && response.data.value && Array.isArray(response.data.value)) {
        records = response.data.value;
      } else if (Array.isArray(response.data)) {
        records = response.data;
      }

      console.error(`✅ Retrieved page ${pageNumber} with ${records.length} records (total: ${totalCount})`);
      return { records, totalCount };

    } catch (error: any) {
      console.error(`❌ Error with paged retrieval:`, error.response?.status || error.message);
      throw error;
    }
  }

  // Get all records at once
  async getAllRecordsAtOnce(url: string): Promise<any[]> {
    if (!this.session?.sessionToken) {
      throw new Error('No valid session token');
    }

    console.error(`🚀 Attempting to retrieve ALL records using: ${url}`);

    try {
      const response: any = await this.axiosInstance.get(url, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        params: { $top: 'all' },
        timeout: 120000
      });

      let allRecords: any[] = [];

      if (response.data && response.data.value && Array.isArray(response.data.value)) {
        allRecords = response.data.value;
      } else if (Array.isArray(response.data)) {
        allRecords = response.data;
      }

      console.error(`✅ Retrieved ${allRecords.length} total records using $top=all`);
      return allRecords;

    } catch (error: any) {
      console.error(`❌ Error with $top=all approach:`, error.response?.status || error.message);
      if (error.response?.status === 404) {
        throw new Error(`ContentAPI endpoint not found: ${url}. This application may not be exposed via ContentAPI.`);
      }
      throw error;
    }
  }

  // Get detailed field information for an application
  async getApplicationFields(appName: string): Promise<any> {
    try {
      const app = await this.getApplicationByName(appName);
      const fields = await this.getModuleFields(app.Id);
      
      return {
        applicationName: app.Name,
        applicationId: app.Id,
        levelId: app.LevelId,
        validatedUrl: app.ValidatedUrl,
        totalActiveFields: fields.length,
        fields: fields.map(field => ({
          id: field.Id,
          name: field.Name,
          alias: field.Alias,
          type: field.Type,
          isActive: field.IsActive,
          isCalculated: field.IsCalculated,
          isRequired: field.IsRequired,
          isKey: field.IsKey,
          guid: field.Guid
        }))
      };
      
    } catch (error: any) {
      console.error('❌ Error getting application fields:', error.message);
      throw error;
    }
  }

  // OPTIMIZED: Get top records efficiently
  async getTopRecords(appName: string, topN: number = 10, sortField?: string): Promise<any> {
    try {
      // OPTIMIZATION: Only fetch what we need
      const searchResults = await this.searchRecords(appName, Math.max(topN * 2, 100), 1, false);
      const records = searchResults.records;
      
      let topRecords = records.slice(0, topN);
      
      if (sortField && records.length > 0) {
        const sampleRecord = records[0];
        const availableFields = Object.keys(sampleRecord);
        
        if (availableFields.includes(sortField)) {
          topRecords = records
            .sort((a: any, b: any) => {
              const aVal = a[sortField];
              const bVal = b[sortField];
              
              if (typeof aVal === 'string' && typeof bVal === 'string') {
                return bVal.localeCompare(aVal);
              } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                return bVal - aVal;
              } else {
                return 0;
              }
            })
            .slice(0, topN);
        }
      }
      
      return {
        records: topRecords,
        totalAvailable: searchResults.totalCount,
        requestedCount: topN,
        returnedCount: topRecords.length,
        sortField: sortField || 'none',
        applicationName: searchResults.applicationName,
        applicationId: searchResults.applicationId,
        validatedUrl: searchResults.validatedUrl,
        transformationSummary: searchResults.transformationSummary // NEW: Include transformation summary
      };
      
    } catch (error: any) {
      console.error('❌ Error getting top records:', error.message);
      throw error;
    }
  }

  // Analyze and filter risk records for critical risks
  async analyzeRisks(appName: string, options: {
    severityThreshold?: string;
    includeOnlyActive?: boolean;
    topN?: number;
    sortBy?: string;
    includeFullData?: boolean;
  } = {}): Promise<any> {
    try {
      const { 
        severityThreshold = 'high',
        includeOnlyActive = true,
        topN = 50,
        sortBy = 'risk_score',
        includeFullData = false
      } = options;

      console.error(`🎯 Analyzing risks in ${appName} with severity threshold: ${severityThreshold}`);
      
      // Fetch risk records with full data if needed
      const searchResults = await this.searchRecords(appName, topN * 2, 1, includeFullData);
      let records = includeFullData && searchResults.allRecords ? searchResults.allRecords : searchResults.records;
      
      // Identify risk-related fields
      const riskFields = {
        severity: null as string | null,
        impact: null as string | null,
        likelihood: null as string | null,
        riskScore: null as string | null,
        status: null as string | null,
        active: null as string | null,
        priority: null as string | null,
        annualizedLoss: null as string | null,
        residualRisk: null as string | null,
        inherentRisk: null as string | null
      };

      // Auto-detect risk fields from first record
      if (records.length > 0) {
        const sampleRecord = records[0];
        const keys = Object.keys(sampleRecord);
        
        // Map common risk field patterns
        keys.forEach(key => {
          const lowerKey = key.toLowerCase();
          if (!riskFields.severity && (lowerKey.includes('severity') || lowerKey.includes('criticality'))) {
            riskFields.severity = key;
          }
          if (!riskFields.impact && lowerKey.includes('impact')) {
            riskFields.impact = key;
          }
          if (!riskFields.likelihood && (lowerKey.includes('likelihood') || lowerKey.includes('probability'))) {
            riskFields.likelihood = key;
          }
          if (!riskFields.riskScore && (lowerKey.includes('risk_score') || lowerKey.includes('riskscore') || lowerKey === 'score')) {
            riskFields.riskScore = key;
          }
          if (!riskFields.status && (lowerKey.includes('status') || lowerKey.includes('state'))) {
            riskFields.status = key;
          }
          if (!riskFields.active && (lowerKey.includes('active') || lowerKey === 'isactive')) {
            riskFields.active = key;
          }
          if (!riskFields.priority && lowerKey.includes('priority')) {
            riskFields.priority = key;
          }
          if (!riskFields.annualizedLoss && lowerKey.includes('annualized_loss')) {
            riskFields.annualizedLoss = key;
          }
          if (!riskFields.residualRisk && lowerKey.includes('residual')) {
            riskFields.residualRisk = key;
          }
          if (!riskFields.inherentRisk && lowerKey.includes('inherent')) {
            riskFields.inherentRisk = key;
          }
        });
      }

      // Filter for active records if requested
      let filteredRecords = records;
      if (includeOnlyActive && riskFields.status) {
        filteredRecords = records.filter((record: any) => {
          const status = record[riskFields.status!];
          if (!status) return true; // Include if no status field
          const statusLower = String(status).toLowerCase();
          return statusLower === 'active' || statusLower === 'open' || statusLower === 'current' || statusLower === '1' || statusLower === 'true';
        });
        console.error(`✅ Filtered to ${filteredRecords.length} active records from ${records.length} total`);
      }

      // Identify critical risks based on severity threshold
      const criticalRisks: any[] = [];
      const highRisks: any[] = [];
      const mediumRisks: any[] = [];
      const lowRisks: any[] = [];
      const unclassifiedRisks: any[] = [];

      filteredRecords.forEach((record: any) => {
        // Try to determine risk level from various fields
        let riskLevel = 'unclassified';
        
        if (riskFields.severity) {
          const severity = String(record[riskFields.severity] || '').toLowerCase();
          if (severity.includes('critical') || severity.includes('extreme') || severity === '5' || severity === '4') {
            riskLevel = 'critical';
          } else if (severity.includes('high') || severity === '3') {
            riskLevel = 'high';
          } else if (severity.includes('medium') || severity.includes('moderate') || severity === '2') {
            riskLevel = 'medium';
          } else if (severity.includes('low') || severity === '1') {
            riskLevel = 'low';
          }
        }
        
        // Also check risk score if available
        if (riskLevel === 'unclassified' && riskFields.riskScore) {
          const score = parseFloat(record[riskFields.riskScore] || '0');
          if (score >= 15) riskLevel = 'critical';
          else if (score >= 10) riskLevel = 'high';
          else if (score >= 5) riskLevel = 'medium';
          else if (score > 0) riskLevel = 'low';
        }

        // Categorize the risk
        switch (riskLevel) {
          case 'critical':
            criticalRisks.push(record);
            break;
          case 'high':
            highRisks.push(record);
            break;
          case 'medium':
            mediumRisks.push(record);
            break;
          case 'low':
            lowRisks.push(record);
            break;
          default:
            unclassifiedRisks.push(record);
        }
      });

      // Sort risks by specified field if available
      const sortRisks = (risks: any[]) => {
        if (sortBy && risks.length > 0) {
          const sortField = riskFields[sortBy as keyof typeof riskFields] || sortBy;
          if (risks[0][sortField] !== undefined) {
            return risks.sort((a, b) => {
              const aVal = a[sortField];
              const bVal = b[sortField];
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return bVal - aVal;
              }
              return String(bVal).localeCompare(String(aVal));
            });
          }
        }
        return risks;
      };

      // Apply threshold filtering
      let risksToReturn: any[] = [];
      const thresholdLower = severityThreshold.toLowerCase();
      
      if (thresholdLower === 'critical' || thresholdLower === 'extreme') {
        risksToReturn = sortRisks(criticalRisks);
      } else if (thresholdLower === 'high') {
        risksToReturn = sortRisks([...criticalRisks, ...highRisks]);
      } else if (thresholdLower === 'medium' || thresholdLower === 'moderate') {
        risksToReturn = sortRisks([...criticalRisks, ...highRisks, ...mediumRisks]);
      } else {
        risksToReturn = sortRisks([...criticalRisks, ...highRisks, ...mediumRisks, ...lowRisks]);
      }

      // Limit to topN
      risksToReturn = risksToReturn.slice(0, topN);

      return {
        applicationName: searchResults.applicationName,
        applicationId: searchResults.applicationId,
        totalRecordsAnalyzed: records.length,
        activeRecordsAnalyzed: filteredRecords.length,
        riskSummary: {
          critical: criticalRisks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          low: lowRisks.length,
          unclassified: unclassifiedRisks.length
        },
        identifiedFields: riskFields,
        severityThreshold: severityThreshold,
        filteredRisks: risksToReturn,
        topRisks: risksToReturn.slice(0, 10), // Always include top 10 for quick view
        recommendations: this.generateRiskRecommendations(criticalRisks, highRisks, riskFields)
      };
      
    } catch (error: any) {
      console.error('❌ Error analyzing risks:', error.message);
      throw error;
    }
  }

  // Generate risk recommendations based on analysis
  private generateRiskRecommendations(criticalRisks: any[], highRisks: any[], riskFields: any): string[] {
    const recommendations: string[] = [];
    
    if (criticalRisks.length > 0) {
      recommendations.push(`URGENT: ${criticalRisks.length} critical risks require immediate attention and mitigation`);
    }
    
    if (highRisks.length > 5) {
      recommendations.push(`WARNING: ${highRisks.length} high-severity risks detected - prioritize review and treatment plans`);
    }
    
    if (!riskFields.severity && !riskFields.riskScore) {
      recommendations.push('DATA QUALITY: Risk severity fields not detected - ensure proper field mapping for risk assessment');
    }
    
    if (riskFields.annualizedLoss) {
      recommendations.push('FINANCIAL: Annualized loss data available - consider financial impact in risk prioritization');
    }
    
    if (riskFields.residualRisk && riskFields.inherentRisk) {
      recommendations.push('CONTROLS: Both inherent and residual risk data available - analyze control effectiveness');
    }
    
    return recommendations;
  }

  // OPTIMIZED: Find record by ID efficiently  
  async findRecordById(appName: string, recordId: string | number): Promise<any> {
    try {
      // OPTIMIZATION: Try to find record in smaller batches first
      const searchResults = await this.searchRecords(appName, 500, 1, false);
      let records = searchResults.records;
      
      let foundRecord = null;
      let idField: string | null = null;
      
      // OPTIMIZATION: Check first batch for record
      if (records.length > 0) {
        const sampleRecord = records[0];
        const idFields = Object.keys(sampleRecord).filter(key => 
          key.toLowerCase().includes('_id') || key.toLowerCase() === 'id'
        );
        
        if (idFields.length > 0) {
          idField = idFields[0];
          foundRecord = records.find((record: any) => 
            record[idField!] == recordId
          );
          
          // If not found in first batch and there are more records, get all and search
          if (!foundRecord && searchResults.totalCount > records.length) {
            console.error(`🔍 Record not found in first batch, searching all ${searchResults.totalCount} records...`);
            const fullResults = await this.searchRecords(appName, 9999, 1, true);
            const allRecords = fullResults.allRecords || [];
            foundRecord = allRecords.find((record: any) => 
              record[idField!] == recordId
            );
            records = allRecords; // Update for final reporting
          }
        }
      }
      
      return {
        record: foundRecord,
        found: !!foundRecord,
        searchedRecords: records.length,
        idField: idField,
        searchedId: recordId,
        applicationName: searchResults.applicationName,
        applicationId: searchResults.applicationId,
        validatedUrl: searchResults.validatedUrl
      };
      
    } catch (error: any) {
      console.error('❌ Error finding record by ID:', error.message);
      throw error;
    }
  }

  // OPTIMIZED: Get record statistics efficiently
  async getRecordStatistics(appName: string): Promise<any> {
    try {
      // Get ALL records for comprehensive analysis - users expect complete statistics
      const searchResults = await this.searchRecords(appName, 0, 1, true); // 0 = no limit, get all records
      const allRecords = searchResults.records;
      
      if (allRecords.length === 0) {
        return {
          totalRecords: 0,
          applicationName: searchResults.applicationName,
          message: 'No records found'
        };
      }
      
      // Validate first record exists and is an object
      if (!allRecords[0] || typeof allRecords[0] !== 'object') {
        return {
          totalRecords: searchResults.totalCount || 0,
          applicationName: searchResults.applicationName,
          applicationId: searchResults.applicationId,
          validatedUrl: searchResults.validatedUrl,
          activeFieldsAvailable: searchResults.fieldCount || 0,
          transformationSummary: searchResults.transformationSummary || 'No transformation data available',
          structure: {
            totalFields: 0,
            idFields: [],
            dateFields: [],
            sampleFields: []
          },
          allRecordIds: []
        };
      }
      
      const firstRecord = allRecords[0];
      const fields = Object.keys(firstRecord) || [];
      
      const idFields = fields.filter(key => 
        key && typeof key === 'string' && (key.toLowerCase().includes('_id') || key.toLowerCase() === 'id')
      ) || [];
      
      const dateFields = fields.filter(key => 
        key && typeof key === 'string' && (
          key.toLowerCase().includes('date') || 
          key.toLowerCase().includes('created') ||
          key.toLowerCase().includes('modified')
        )
      ) || [];
      
      // Safely generate sample record IDs from all records with validation  
      const sampleRecordIds = allRecords.slice(0, 10).map((record: any) => {
        if (!record || typeof record !== 'object') return 'Invalid record';
        const idField = idFields[0];
        return idField && record[idField] !== undefined ? record[idField] : 'No ID found';
      });
      
      return {
        totalRecords: allRecords.length, // Use actual record count from retrieved data
        retrievedRecords: allRecords.length, // Clearly show how many records were analyzed
        applicationName: searchResults.applicationName,
        applicationId: searchResults.applicationId,
        validatedUrl: searchResults.validatedUrl,
        activeFieldsAvailable: searchResults.fieldCount || 0,
        transformationSummary: searchResults.transformationSummary || 'No transformation data available',
        structure: {
          totalFields: fields.length,
          idFields: idFields,
          dateFields: dateFields,
          sampleFields: fields.slice(0, 10)
        },
        sampleRecordIds: sampleRecordIds,
        analysisScope: `Complete analysis of all ${allRecords.length} records`
      };
      
    } catch (error: any) {
      console.error('❌ Error getting record statistics:', error.message);
      throw error;
    }
  }

  // Test the connection
  async testConnection(): Promise<string> {
    try {
      await this.login();
      
      // Also test Level API
      const levels = await this.getLevelMappings();
      
      return `Successfully connected to Archer at ${this.config.baseUrl}\nInstance: ${this.config.instanceName}\nUser: ${this.config.username}\nLevel mappings available: ${levels.length}\nData transformation: Enabled`;
    } catch (error: any) {
      return `Failed to connect to Archer: ${error.message}`;
    }
  }

  // Get all datafeeds
  async getDatafeeds(activeOnly: boolean = true): Promise<any[]> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error('🔍 Fetching datafeeds from /api/core/datafeed...');
      
      const response = await this.axiosInstance.get('/api/core/datafeed', {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const datafeeds: any[] = [];
      
      if (Array.isArray(response.data)) {
        response.data.forEach((item: any) => {
          if (item.RequestedObject) {
            const df = item.RequestedObject;
            // Filter by active status if requested
            if (!activeOnly || df.Active === true) {
              datafeeds.push({
                guid: df.Guid,
                name: df.Name,
                active: df.Active
              });
            }
          }
        });
      }
      
      console.error(`✅ Found ${datafeeds.length} ${activeOnly ? 'active' : 'total'} datafeeds`);
      return datafeeds;
      
    } catch (error: any) {
      console.error('❌ Error fetching datafeeds:', error.message);
      throw error;
    }
  }

  // Get datafeed run history
  async getDatafeedHistory(datafeedGuid: string): Promise<any> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Fetching history for datafeed ${datafeedGuid}...`);
      
      // POST request with GUID in body and X-HTTP-Method-Override header
      const response = await this.axiosInstance.post('/api/core/datafeed/history', {
        Guid: datafeedGuid
      }, {
        headers: {
          'Authorization': `Archer session-id=${this.session?.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-HTTP-Method-Override': 'GET'
        }
      });
      
      return response.data;
      
    } catch (error: any) {
      console.error(`❌ Error fetching datafeed history: ${error.message}`);
      throw error;
    }
  }

  // Get datafeed history messages for a specific run
  async getDatafeedHistoryMessages(historyId: string | number): Promise<any> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Fetching history messages for datafeed history ID ${historyId}...`);
      
      const response = await this.axiosInstance.get(`/api/core/datafeed/historymessage/${historyId}`, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.error(`✅ Retrieved history messages for ID ${historyId}`);
      
      return response.data;
      
    } catch (error: any) {
      console.error(`❌ Error fetching datafeed history messages: ${error.message}`);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      throw error;
    }
  }

  // Get recent datafeed run
  async getDatafeedRecentRun(datafeedGuid: string): Promise<any> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔍 Fetching recent run for datafeed ${datafeedGuid}...`);
      
      // Just get the full history and extract the most recent
      const history = await this.getDatafeedHistory(datafeedGuid);
      
      if (history && Array.isArray(history)) {
        // Return the most recent run (first item)
        return history[0] || null;
      } else if (history && history.RequestedObject) {
        // If history returns a single object, return it
        return history;
      }
      
      return null;
      
    } catch (error: any) {
      console.error(`❌ Error fetching recent datafeed run: ${error.message}`);
      throw error;
    }
  }

  // Check datafeed health
  async checkDatafeedHealth(): Promise<any> {
    try {
      console.error('🏥 Starting datafeed health check...');
      
      // Get all active datafeeds
      const datafeeds = await this.getDatafeeds(true);
      
      if (datafeeds.length === 0) {
        return {
          totalDatafeeds: 0,
          healthSummary: 'No active datafeeds found',
          datafeeds: []
        };
      }
      
      const healthResults: any[] = [];
      let failedCount = 0;
      let warningCount = 0;
      let healthyCount = 0;
      
      // Check each datafeed
      for (const df of datafeeds) {
        try {
          console.error(`📊 Checking health for: ${df.name}`);
          
          const recentRun = await this.getDatafeedRecentRun(df.guid);
          
          let status = 'Unknown';
          let lastRunDate = null;
          let runStatus = null;
          let errorMessage = null;
          let healthStatus = 'Unknown';
          
          if (recentRun && recentRun.RequestedObject) {
            const run = recentRun.RequestedObject;
            lastRunDate = run.StartTime || run.EndTime;
            
            // Map numeric status to text
            if (run.Status === 2) {
              runStatus = 'Success';
              healthStatus = 'Healthy';
              healthyCount++;
            } else if (run.Status === 3) {
              runStatus = 'Failed';
              healthStatus = 'Failed';
              failedCount++;
              errorMessage = run.ErrorMessage || 'Run failed without error message';
            } else if (run.Status === 1) {
              runStatus = 'Running';
              healthStatus = 'Running';
              warningCount++;
            } else {
              runStatus = `Status Code: ${run.Status}`;
              healthStatus = 'Warning';
              warningCount++;
            }
          } else {
            healthStatus = 'No Recent Runs';
            warningCount++;
          }
          
          healthResults.push({
            name: df.name,
            guid: df.guid,
            healthStatus: healthStatus,
            lastRunDate: lastRunDate,
            runStatus: runStatus,
            errorMessage: errorMessage
          });
          
        } catch (error: any) {
          console.error(`⚠️ Error checking ${df.name}: ${error.message}`);
          healthResults.push({
            name: df.name,
            guid: df.guid,
            healthStatus: 'Error',
            error: error.message
          });
          failedCount++;
        }
      }
      
      return {
        totalDatafeeds: datafeeds.length,
        healthSummary: {
          healthy: healthyCount,
          warnings: warningCount,
          failed: failedCount
        },
        datafeeds: healthResults
      };
      
    } catch (error: any) {
      console.error('❌ Error checking datafeed health:', error.message);
      throw error;
    }
  }

  // NEW: Get security events
  async getSecurityEvents(instanceName: string, eventType: string = "all events", eventsForDate: string): Promise<any> {
    await this.ensureValidSession();
    
    try {
      if (!this.session?.sessionToken) {
        throw new Error('No valid session token');
      }
      
      console.error(`🔒 Fetching security events for date: ${eventsForDate}, type: ${eventType}...`);
      
      const requestBody: SecurityEventRequest = {
        InstanceName: instanceName,
        EventType: eventType,
        EventsForDate: eventsForDate
      };
      
      // POST request to security events endpoint with X-HTTP-Method-Override header
      const response = await this.axiosInstance.post('/api/core/system/AccessControlReports/SecurityEvents', requestBody, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-HTTP-Method-Override': 'GET'
        }
      });
      
      console.error(`✅ Retrieved security events for ${eventsForDate}`);
      
      // Process and format the response
      let events: SecurityEvent[] = [];
      let totalEvents = 0;
      
      if (response.data && response.data.Links) {
        // Count total events from Links array
        totalEvents = response.data.Links.length;
        
        // Extract events from RequestedObject if available
        if (response.data.RequestedObject && Array.isArray(response.data.RequestedObject)) {
          events = response.data.RequestedObject;
        }
      } else if (Array.isArray(response.data)) {
        events = response.data;
        totalEvents = events.length;
      }
      
      return {
        instanceName: instanceName,
        eventType: eventType,
        eventsForDate: eventsForDate,
        totalEvents: totalEvents,
        events: events,
        metadata: {
          requestTime: new Date().toISOString(),
          responseType: 'SecurityEvents',
          eventCount: events.length
        }
      };
      
    } catch (error: any) {
      console.error(`❌ Error fetching security events: ${error.message}`);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
      }
      throw error;
    }
  }
}

// Initialize Archer client
const archerConfig: ArcherConfig = {
  baseUrl: process.env.ARCHER_BASE_URL || '',
  instanceName: process.env.ARCHER_INSTANCE || '',
  username: process.env.ARCHER_USERNAME || '',
  password: process.env.ARCHER_PASSWORD || ''
};

const archerClient = new ArcherAPIClient(archerConfig);

// Create MCP server
const server = new Server(
  {
    name: 'archer-mcp-server',
    version: '6.1.0', // UPDATED version for security events support
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'test_archer_connection',
        description: 'Test connection to RSA Archer instance and authenticate',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
      },
      {
        name: 'debug_archer_api',
        description: 'Debug Archer API responses to see what is actually being returned',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'API endpoint to test (e.g., "api/core/system/level" or "contentapi/Risk_Register")',
              default: 'api/core/system/level'
            }
          },
          required: []
        },
      },
      {
        name: 'get_archer_applications',
        description: 'DISCOVERY: List all available Archer applications and questionnaires. Use FIRST when you need to discover what applications exist or find the correct application name for data retrieval. Essential for application discovery workflows.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
      },
      {
        name: 'get_application_fields',
        description: 'STEP 0: Get field definitions and structure for an Archer application. Use when you need to understand available fields, data types, or structure before data retrieval. Not needed for most analysis workflows.',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the Archer application'
            }
          },
          required: ['applicationName']
        },
      },
      {
        name: 'search_archer_records',
        description: 'STEP 1: Retrieve raw data records from Archer applications. Use this FIRST to get the underlying data before any analysis. Essential for workflows requiring actual record data for counting, analysis, or evaluation.',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the Archer application (e.g., "Risk Register", "Controls", "Incidents and Requests")'
            },
            pageSize: {
              type: 'number',
              description: 'Number of records to retrieve per page (default: 100, max recommended: 500)',
              default: 100
            },
            pageNumber: {
              type: 'number',
              description: 'Page number to retrieve (default: 1)',
              default: 1
            },
            includeFullData: {
              type: 'boolean',
              description: 'Fetch ALL records (slower, for comprehensive analysis). Default: false (faster, paginated access)',
              default: false
            }
          },
          required: ['applicationName']
        },
      },
      {
        name: 'get_top_records',
        description: 'Get top N records from an application, optionally sorted by a field',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the Archer application'
            },
            topN: {
              type: 'number',
              description: 'Number of top records to retrieve (default: 10)',
              default: 10
            },
            sortField: {
              type: 'string',
              description: 'Optional field name to sort by'
            }
          },
          required: ['applicationName']
        },
      },
      {
        name: 'find_record_by_id',
        description: 'Find a specific record by its ID in an application',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the Archer application'
            },
            recordId: {
              type: ['string', 'number'],
              description: 'The record ID to search for'
            }
          },
          required: ['applicationName', 'recordId']
        },
      },
      {
        name: 'analyze_risks',
        description: 'STEP 2: Intelligent risk analysis that retrieves AND analyzes risk data automatically. Identifies critical risks, categorizes by severity, and provides risk insights. Can be used as a complete workflow for risk-specific queries.',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the risk application (e.g., "Risk Register", "Enterprise Risks")'
            },
            severityThreshold: {
              type: 'string',
              description: 'Minimum severity level to include: "critical", "high", "medium", or "low" (default: "high")',
              enum: ['critical', 'high', 'medium', 'low'],
              default: 'high'
            },
            includeOnlyActive: {
              type: 'boolean',
              description: 'Filter to only include active/open risks (default: true)',
              default: true
            },
            topN: {
              type: 'number',
              description: 'Maximum number of risks to return (default: 50)',
              default: 50
            },
            sortBy: {
              type: 'string',
              description: 'Field to sort risks by: "risk_score", "impact", "likelihood", "priority" (default: "risk_score")',
              enum: ['risk_score', 'impact', 'likelihood', 'priority'],
              default: 'risk_score'
            },
            includeFullData: {
              type: 'boolean',
              description: 'Analyze ALL records (slower) vs paginated subset (default: false)',
              default: false
            }
          },
          required: ['applicationName']
        },
      },
      {
        name: 'get_record_statistics',
        description: 'STEP 2: Analyze retrieved data to generate statistics, counts, and insights. Use AFTER getting raw data with search_archer_records. Perfect for counting, grouping, and evaluating patterns in the data.',
        inputSchema: {
          type: 'object',
          properties: {
            applicationName: {
              type: 'string',
              description: 'Name of the Archer application'
            }
          },
          required: ['applicationName']
        },
      },
      {
        name: 'get_datafeeds',
        description: 'Get list of datafeeds from Archer',
        inputSchema: {
          type: 'object',
          properties: {
            activeOnly: {
              type: 'boolean',
              description: 'Only return active datafeeds (default: true)',
              default: true
            }
          },
          required: []
        },
      },
      {
        name: 'get_datafeed_history',
        description: 'Get run history for a specific datafeed',
        inputSchema: {
          type: 'object',
          properties: {
            datafeedGuid: {
              type: 'string',
              description: 'GUID of the datafeed'
            }
          },
          required: ['datafeedGuid']
        },
      },
      {
        name: 'get_datafeed_history_messages',
        description: 'Get detailed messages for a specific datafeed history run. Use the history ID from get_datafeed_history results.',
        inputSchema: {
          type: 'object',
          properties: {
            historyId: {
              type: ['string', 'number'],
              description: 'History ID from a datafeed run (obtained from get_datafeed_history)'
            }
          },
          required: ['historyId']
        },
      },
      {
        name: 'check_datafeed_health',
        description: 'Check health status of all active datafeeds, identifying failures and missed runs',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
      },
      {
        name: 'get_security_events',
        description: 'Get security events from Archer for a specific date and event type. Similar to datafeed history functionality.',
        inputSchema: {
          type: 'object',
          properties: {
            instanceName: {
              type: 'string',
              description: 'Archer instance name (e.g., "710100")'
            },
            eventType: {
              type: 'string',
              description: 'Type of security events to retrieve (default: "all events")',
              default: 'all events'
            },
            eventsForDate: {
              type: 'string',
              description: 'Date for which to retrieve events in YYYY-MM-DD format (e.g., "2025-08-05")'
            }
          },
          required: ['instanceName', 'eventsForDate']
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  
  try {
    switch (name) {
      case 'test_archer_connection':
        const connectionResult = await archerClient.testConnection();
        return {
          content: [
            {
              type: 'text',
              text: connectionResult,
            },
          ],
        };

      case 'debug_archer_api':
        try {
          const args = request.params.arguments as { endpoint?: string };
          const endpoint = args.endpoint || 'api/core/system/level';
          
          const debugInfo = await archerClient.debugApiCall(endpoint);
          
          let resultText = `=== ARCHER API DEBUG RESULTS ===\n`;
          resultText += `Endpoint: ${debugInfo.endpoint}\n`;
          resultText += `Full URL: ${debugInfo.fullUrl}\n`;
          resultText += `Timestamp: ${debugInfo.timestamp}\n`;
          resultText += `Session Valid: ${debugInfo.sessionValid}\n`;
          resultText += `Session Token: ${debugInfo.sessionToken}\n\n`;
          
          if (debugInfo.success) {
            resultText += `✅ SUCCESS!\n`;
            resultText += `Status Code: ${debugInfo.statusCode}\n`;
            resultText += `Response Keys: ${debugInfo.responseKeys.join(', ')}\n`;
            resultText += `Items Count: ${debugInfo.moduleRowsCount}\n\n`;
            
            if (debugInfo.sampleData) {
              resultText += `Sample Data:\n${JSON.stringify(debugInfo.sampleData, null, 2)}`;
            }
          } else {
            resultText += `❌ FAILED!\n`;
            resultText += `Error: ${debugInfo.error?.message}\n`;
            resultText += `Status: ${debugInfo.error?.status}\n`;
            if (debugInfo.error?.responseData) {
              resultText += `Response: ${JSON.stringify(debugInfo.error.responseData, null, 2)}`;
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Debug tool error: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_archer_applications':
        try {
          // Get both applications and questionnaires
          // DEBUG: Starting to fetch applications and questionnaires...
          
          const applications = await archerClient.getApplications();
          // DEBUG: Got ${applications.length} applications
          
          let questionnaires: ArcherQuestionnaire[] = [];
          try {
            questionnaires = await archerClient.getQuestionnaires();
            // DEBUG: Got ${questionnaires.length} questionnaires
          } catch (questionnaireError: any) {
            // DEBUG: Error fetching questionnaires: ${questionnaireError.message}
            if (questionnaireError.response) {
              // DEBUG: Questionnaire error status: ${questionnaireError.response.status}
              // DEBUG: Questionnaire error data: ${JSON.stringify(questionnaireError.response.data, null, 2).substring(0, 300)}
            }
          }
          
          let resultList = '';
          
          // Applications section
          if (applications.length > 0) {
            const appList = applications.map((app: ArcherApplication) => {
              const parts = [`ID: ${app.Id}`];
              if (app.Alias) parts.push(`Alias: ${app.Alias}`);
              parts.push(`GUID: ${app.Guid}`);
              parts.push(`Status: ACTIVE`);
              if (app.ValidatedUrl) {
                parts.push(`URL: ${app.ValidatedUrl}`);
              } else {
                parts.push('URL: NOT AVAILABLE');
              }
              
              return `- ${app.Name} (${parts.join(', ')})`;
            }).join('\n');
            
            resultList += `📋 APPLICATIONS (${applications.length}):\n${appList}`;
          } else {
            resultList += `📋 APPLICATIONS: No ACTIVE applications found`;
          }
          
          // Questionnaires section
          if (questionnaires.length > 0) {
            const questionnaireList = questionnaires.map((quest: ArcherQuestionnaire) => {
              const parts = [`ID: ${quest.Id}`];
              if (quest.Alias) parts.push(`Alias: ${quest.Alias}`);
              parts.push(`GUID: ${quest.Guid}`);
              parts.push(`Status: ACTIVE`);
              if (quest.TargetLevelId) parts.push(`TargetLevel: ${quest.TargetLevelId}`);
              if (quest.ValidatedUrl) {
                parts.push(`URL: ${quest.ValidatedUrl}`);
              } else {
                parts.push('URL: NOT AVAILABLE');
              }
              
              return `- ${quest.Name} (${parts.join(', ')})`;
            }).join('\n');
            
            resultList += `\n\n📊 QUESTIONNAIRES (${questionnaires.length}):\n${questionnaireList}`;
          } else {
            resultList += `\n\n📊 QUESTIONNAIRES: No ACTIVE questionnaires found`;
          }
          
          // For application lists, minimal privacy protection (just application names are not sensitive)
          const protectedResult = resultList;
          
          return {
            content: [
              {
                type: 'text',
                text: `ACTIVE Archer Applications and Questionnaires with Level-based URLs:\n\n${protectedResult}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching applications: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_application_fields':
        try {
          const args = request.params.arguments as { applicationName: string };
          const applicationName = args.applicationName;
          
          const fieldInfo = await archerClient.getApplicationFields(applicationName);
          
          let resultText = `ACTIVE Field Information for "${fieldInfo.applicationName}" (ID: ${fieldInfo.applicationId})\n`;
          if (fieldInfo.levelId) {
            resultText += `Level ID: ${fieldInfo.levelId}\n`;
          }
          resultText += `ContentAPI URL: ${fieldInfo.validatedUrl || 'NOT AVAILABLE'}\n`;
          resultText += `Total ACTIVE Fields: ${fieldInfo.totalActiveFields}\n\n`;
          
          if (fieldInfo.fields.length > 0) {
            resultText += 'ACTIVE Fields:\n';
            fieldInfo.fields.forEach((field: any, index: number) => {
              const badges = [];
              if (field.isKey) badges.push('KEY');
              if (field.isRequired) badges.push('REQUIRED');
              if (field.isCalculated) badges.push('CALCULATED');
              
              const badgeText = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
              resultText += `${index + 1}. ${field.name} (Alias: ${field.alias}, Type: ${field.type})${badgeText}\n`;
            });
          } else {
            resultText += 'No ACTIVE fields found.';
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting application fields: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'search_archer_records':
        try {
          const args = request.params.arguments as {
            applicationName: string;
            pageSize?: number;
            pageNumber?: number;
            includeFullData?: boolean;
          };
          
          const applicationName = args.applicationName;
          const pageSize = Math.min(args.pageSize || 100, 500);
          const pageNumber = args.pageNumber || 1;
          const includeFullData = args.includeFullData || false;
          
          const searchResults = await archerClient.searchRecords(applicationName, pageSize, pageNumber, includeFullData);
          
          let resultText = `🔍 Records from "${searchResults.applicationName}"\n`;
          resultText += `🔒 PRIVACY PROTECTION: Sensitive data has been masked for security\n`;
          resultText += `ContentAPI URL: ${searchResults.validatedUrl}\n`;
          resultText += `Total Records: ${searchResults.totalCount.toLocaleString()}\n`;
          resultText += `Page ${searchResults.pageNumber} of ${searchResults.totalPages} (${searchResults.metadata.recordsPerPage} records)\n`;
          resultText += `Active Fields Available: ${searchResults.fieldCount}\n`;
          resultText += `Data Completeness: ${searchResults.metadata.dataCompleteness}\n`;
          resultText += `All Fields Included: ${searchResults.metadata.allFieldsIncluded}\n`;
          resultText += `Retrieval Method: ${searchResults.metadata.retrievalMethod}\n\n`;
          
          // Include transformation summary (with privacy protection)
          if (searchResults.transformationSummary) {
            const protectedSummary = archerClient.privacyProtector.protectData(
              searchResults.transformationSummary, 
              'transformation_summary'
            );
            resultText += `${protectedSummary}\n\n`;
          }
          
          if (includeFullData && searchResults.allRecords && searchResults.allRecords.length > 0) {
            // OPTIMIZATION: Limit output size for very large datasets
            const maxRecordsToShow = Math.min(searchResults.allRecords.length, 50);
            const shouldTruncate = searchResults.allRecords.length > maxRecordsToShow;
            
            resultText += `📊 SHOWING ${shouldTruncate ? 'FIRST ' + maxRecordsToShow + ' OF ' : ''}${searchResults.allRecords.length} RECORDS WITH COMPLETE FIELD DATA:\n`;
            if (shouldTruncate) {
              resultText += `⚠️ Output truncated to first ${maxRecordsToShow} records for performance\n`;
            }
            resultText += `${'='.repeat(80)}\n\n`;
            
            // OPTIMIZATION: Only process the records we're going to display
            const recordsToDisplay = searchResults.allRecords.slice(0, maxRecordsToShow);
            
            // Apply privacy protection to display records only
            const protectedRecords = archerClient.privacyProtector.protectData(
              recordsToDisplay, 
              'search_results_full_data'
            );
            
            protectedRecords.forEach((record: any, index: number) => {
              resultText += `RECORD ${index + 1} of ${recordsToDisplay.length}:\n`;
              resultText += `${'-'.repeat(40)}\n`;
              
              // OPTIMIZATION: Limit fields shown per record
              const entries = Object.entries(record);
              const maxFieldsPerRecord = 20;
              let fieldCount = 0;
              
              for (const [key, value] of entries) {
                if (value !== null && value !== undefined && value !== '' && fieldCount < maxFieldsPerRecord) {
                  let displayValue = value;
                  
                  if (Array.isArray(value)) {
                    if (value.length === 0) {
                      continue; // Skip empty arrays
                    }
                    displayValue = `[Array with ${value.length} items]`;
                    if (value.length <= 3) {
                      displayValue = JSON.stringify(value);
                    }
                  } else if (typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                  }
                  
                  // Truncate very long values for display
                  if (typeof displayValue === 'string' && displayValue.length > 200) {
                    displayValue = displayValue.substring(0, 200) + '... [truncated]';
                  }
                  
                  resultText += `${key}: ${displayValue}\n`;
                  fieldCount++;
                }
              }
              
              if (fieldCount >= maxFieldsPerRecord && entries.length > maxFieldsPerRecord) {
                resultText += `... and ${entries.length - maxFieldsPerRecord} more fields\n`;
              }
              
              resultText += '\n';
            });
          } else {
            // Standard paginated view with privacy protection
            if (searchResults.records.length > 0) {
              resultText += `Records on this page:\n`;
              
              // Apply privacy protection to page records
              const protectedPageRecords = archerClient.privacyProtector.protectData(
                searchResults.records, 
                'search_results_page_data'
              );
              
              protectedPageRecords.forEach((record: any, index: number) => {
                const recordNum = (pageNumber - 1) * pageSize + index + 1;
                resultText += `\n${recordNum}. Record:\n`;
                
                if (typeof record === 'object' && record !== null) {
                  const keys = Object.keys(record);
                  const idFields = keys.filter(key => key.toLowerCase().includes('_id') || key.toLowerCase() === 'id');
                  const otherFields = keys.filter(key => !key.toLowerCase().includes('_id') && key.toLowerCase() !== 'id');
                  
                  idFields.slice(0, 2).forEach(key => {
                    resultText += `   ${key}: ${record[key]}\n`;
                  });
                  
                  otherFields.slice(0, 3).forEach(key => {
                    let value = record[key];
                    if (typeof value === 'object' && value !== null) {
                      if (Array.isArray(value)) {
                        value = `[Array with ${value.length} items]`;
                      } else {
                        value = JSON.stringify(value).substring(0, 50) + '...';
                      }
                    } else if (typeof value === 'string' && value.length > 50) {
                      value = value.substring(0, 50) + '...';
                    }
                    resultText += `   ${key}: ${value}\n`;
                  });
                  
                  if (keys.length > 5) {
                    resultText += `   ... and ${keys.length - 5} more fields\n`;
                  }
                }
              });
              
              if (searchResults.metadata.hasMorePages) {
                resultText += `\n📄 More pages available. Use pageNumber: ${pageNumber + 1} to see next page.`;
              }
              
              resultText += `\n\n💡 TIP: Use includeFullData: true to see ALL records with complete field data.`;
            } else {
              resultText += 'No records found in this application.';
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error searching records: ${archerClient.privacyProtector.protectErrorData(error).message}`,
              },
            ],
          };
        }
        break;

      case 'get_top_records':
        try {
          const args = request.params.arguments as {
            applicationName: string;
            topN?: number;
            sortField?: string;
          };
          
          const topResults = await archerClient.getTopRecords(
            args.applicationName, 
            args.topN || 10, 
            args.sortField
          );
          
          let resultText = `🔍 Top ${topResults.returnedCount} records from "${topResults.applicationName}"\n`;
          resultText += `🔒 PRIVACY PROTECTION: Sensitive data has been masked for security\n`;
          resultText += `ContentAPI URL: ${topResults.validatedUrl}\n`;
          resultText += `Total Available: ${topResults.totalAvailable.toLocaleString()}\n`;
          resultText += `Sort Field: ${topResults.sortField}\n\n`;
          
          // NEW: Include transformation summary if available (with privacy protection)
          if (topResults.transformationSummary) {
            const protectedSummary = archerClient.privacyProtector.protectData(
              topResults.transformationSummary, 
              'top_records_summary'
            );
            resultText += `${protectedSummary}\n\n`;
          }
          
          // Apply privacy protection to top records
          const protectedTopRecords = archerClient.privacyProtector.protectData(
            topResults.records, 
            'top_records_data'
          );
          
          protectedTopRecords.forEach((record: any, index: number) => {
            resultText += `${index + 1}. `;
            
            const keys = Object.keys(record);
            const idFields = keys.filter(key => key.toLowerCase().includes('_id'));
            
            if (idFields.length > 0) {
              resultText += `${idFields[0]}: ${record[idFields[0]]}`;
            }
            
            const otherFields = keys.filter(key => 
              !key.toLowerCase().includes('_id') && 
              typeof record[key] !== 'object'
            ).slice(0, 2);
            
            otherFields.forEach(field => {
              let value = record[field];
              if (typeof value === 'string' && value.length > 30) {
                value = value.substring(0, 30) + '...';
              }
              resultText += `, ${field}: ${value}`;
            });
            
            resultText += '\n';
          });
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting top records: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'find_record_by_id':
        try {
          const args = request.params.arguments as {
            applicationName: string;
            recordId: string | number;
          };
          
          const findResult = await archerClient.findRecordById(args.applicationName, args.recordId);
          
          let resultText = `Search for Record ID ${findResult.searchedId} in "${findResult.applicationName}"\n`;
          resultText += `ContentAPI URL: ${findResult.validatedUrl}\n`;
          resultText += `Searched ${findResult.searchedRecords} records\n`;
          resultText += `ID Field: ${findResult.idField}\n\n`;
          
          if (findResult.found && findResult.record) {
            resultText += `✅ FOUND RECORD:\n`;
            
            const keys = Object.keys(findResult.record);
            keys.slice(0, 10).forEach(key => {
              let value = findResult.record[key];
              if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                  value = `[Array with ${value.length} items]`;
                } else {
                  value = JSON.stringify(value).substring(0, 100) + '...';
                }
              } else if (typeof value === 'string' && value.length > 100) {
                value = value.substring(0, 100) + '...';
              }
              resultText += `${key}: ${value}\n`;
            });
            
            if (keys.length > 10) {
              resultText += `... and ${keys.length - 10} more fields\n`;
            }
          } else {
            resultText += `❌ Record not found`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error finding record: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'analyze_risks':
        try {
          const args = request.params.arguments as {
            applicationName: string;
            severityThreshold?: string;
            includeOnlyActive?: boolean;
            topN?: number;
            sortBy?: string;
            includeFullData?: boolean;
          };
          
          const riskAnalysis = await archerClient.analyzeRisks(args.applicationName, {
            severityThreshold: args.severityThreshold || 'high',
            includeOnlyActive: args.includeOnlyActive !== false,
            topN: args.topN || 50,
            sortBy: args.sortBy || 'risk_score',
            includeFullData: args.includeFullData || false
          });
          
          let resultText = `RISK ANALYSIS for "${riskAnalysis.applicationName}"\n`;
          resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          
          resultText += `ANALYSIS SUMMARY:\n`;
          resultText += `Total Records Analyzed: ${riskAnalysis.totalRecordsAnalyzed}\n`;
          resultText += `Active Records: ${riskAnalysis.activeRecordsAnalyzed}\n`;
          resultText += `Severity Threshold: ${riskAnalysis.severityThreshold.toUpperCase()}\n\n`;
          
          resultText += `RISK DISTRIBUTION:\n`;
          if (riskAnalysis.riskSummary.critical > 0) {
            resultText += `🔴 Critical: ${riskAnalysis.riskSummary.critical} risks\n`;
          }
          if (riskAnalysis.riskSummary.high > 0) {
            resultText += `🟠 High: ${riskAnalysis.riskSummary.high} risks\n`;
          }
          if (riskAnalysis.riskSummary.medium > 0) {
            resultText += `🟡 Medium: ${riskAnalysis.riskSummary.medium} risks\n`;
          }
          if (riskAnalysis.riskSummary.low > 0) {
            resultText += `🟢 Low: ${riskAnalysis.riskSummary.low} risks\n`;
          }
          if (riskAnalysis.riskSummary.unclassified > 0) {
            resultText += `⚪ Unclassified: ${riskAnalysis.riskSummary.unclassified} risks\n`;
          }
          resultText += '\n';
          
          // Show identified fields
          resultText += `IDENTIFIED RISK FIELDS:\n`;
          const fields = riskAnalysis.identifiedFields;
          if (fields.severity) resultText += `• Severity: ${fields.severity}\n`;
          if (fields.impact) resultText += `• Impact: ${fields.impact}\n`;
          if (fields.likelihood) resultText += `• Likelihood: ${fields.likelihood}\n`;
          if (fields.riskScore) resultText += `• Risk Score: ${fields.riskScore}\n`;
          if (fields.priority) resultText += `• Priority: ${fields.priority}\n`;
          if (fields.status) resultText += `• Status: ${fields.status}\n`;
          if (fields.annualizedLoss) resultText += `• Annualized Loss: ${fields.annualizedLoss}\n`;
          if (fields.residualRisk) resultText += `• Residual Risk: ${fields.residualRisk}\n`;
          if (fields.inherentRisk) resultText += `• Inherent Risk: ${fields.inherentRisk}\n`;
          resultText += '\n';
          
          // Show recommendations
          if (riskAnalysis.recommendations && riskAnalysis.recommendations.length > 0) {
            resultText += `RECOMMENDATIONS:\n`;
            riskAnalysis.recommendations.forEach((rec: string) => {
              resultText += `⚠️ ${rec}\n`;
            });
            resultText += '\n';
          }
          
          // Show top risks with privacy protection
          if (riskAnalysis.topRisks && riskAnalysis.topRisks.length > 0) {
            resultText += `TOP ${riskAnalysis.topRisks.length} RISKS (Privacy Protected):\n`;
            resultText += `────────────────────────────────────────\n`;
            
            const protectedRisks = archerClient.privacyProtector.protectData(
              riskAnalysis.topRisks,
              'risk_analysis'
            );
            
            protectedRisks.forEach((risk: any, index: number) => {
              resultText += `\n${index + 1}. Risk Record:\n`;
              
              // Show key risk fields
              const riskKeys = Object.keys(risk).filter(key => {
                const lowerKey = key.toLowerCase();
                return lowerKey.includes('id') || 
                       lowerKey.includes('name') || 
                       lowerKey.includes('severity') ||
                       lowerKey.includes('impact') ||
                       lowerKey.includes('likelihood') ||
                       lowerKey.includes('score') ||
                       lowerKey.includes('status') ||
                       lowerKey.includes('description') ||
                       lowerKey.includes('title');
              }).slice(0, 8);
              
              riskKeys.forEach(key => {
                let value = risk[key];
                if (typeof value === 'object' && value !== null) {
                  value = JSON.stringify(value).substring(0, 50) + '...';
                } else if (typeof value === 'string' && value.length > 100) {
                  value = value.substring(0, 100) + '...';
                }
                resultText += `  ${key}: ${value}\n`;
              });
            });
          } else {
            resultText += `No risks found matching the specified criteria.\n`;
          }
          
          resultText += `\n💡 TIP: Adjust severityThreshold, includeOnlyActive, or includeFullData parameters for different analysis perspectives.`;
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing risks: ${archerClient.privacyProtector.protectErrorData(error).message}`,
              },
            ],
          };
        }
        break;

      case 'get_record_statistics':
        try {
          const args = request.params.arguments as {
            applicationName: string;
          };
          
          const stats = await archerClient.getRecordStatistics(args.applicationName);
          
          let resultText = `📊 Statistics for "${stats.applicationName}"\n`;
          resultText += `🔒 PRIVACY PROTECTION: Sensitive data has been masked for security\n`;
          resultText += `Total Records: ${stats.totalRecords.toLocaleString()}\n`;
          resultText += `Application ID: ${stats.applicationId}\n`;
          resultText += `ContentAPI URL: ${stats.validatedUrl}\n`;
          resultText += `Active Fields Available: ${stats.activeFieldsAvailable}\n\n`;
          
          // NEW: Include transformation summary if available (with privacy protection)
          if (stats.transformationSummary) {
            const protectedSummary = archerClient.privacyProtector.protectData(
              stats.transformationSummary, 
              'data_quality_summary'
            );
            resultText += `${protectedSummary}\n\n`;
          }
          
          if (stats.structure) {
            resultText += `Data Structure:\n`;
            resultText += `- Total Fields in Records: ${stats.structure.totalFields}\n`;
            resultText += `- ID Fields: ${Array.isArray(stats.structure.idFields) ? stats.structure.idFields.join(', ') : 'None found'}\n`;
            resultText += `- Date Fields: ${Array.isArray(stats.structure.dateFields) ? stats.structure.dateFields.join(', ') : 'None found'}\n`;
            resultText += `- Sample Fields: ${Array.isArray(stats.structure.sampleFields) ? stats.structure.sampleFields.join(', ') : 'None found'}\n\n`;
          }
          
          // Fix: Use sampleRecordIds instead of recordIds and add validation
          if (stats.sampleRecordIds && Array.isArray(stats.sampleRecordIds) && stats.sampleRecordIds.length > 0) {
            resultText += `Sample Record IDs:\n`;
            stats.sampleRecordIds.forEach((id: any, index: number) => {
              resultText += `${index + 1}. ${id}\n`;
            });
          } else {
            resultText += `Sample Record IDs: No sample records available\n`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting statistics: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_datafeeds':
        try {
          const args = request.params.arguments as {
            activeOnly?: boolean;
          };
          
          const datafeeds = await archerClient.getDatafeeds(args.activeOnly !== false);
          
          let resultText = `Archer Datafeeds (${args.activeOnly !== false ? 'Active Only' : 'All'}):\n`;
          resultText += `Total Found: ${datafeeds.length}\n\n`;
          
          if (datafeeds.length > 0) {
            datafeeds.forEach((df: any, index: number) => {
              resultText += `${index + 1}. ${df.name}\n`;
              resultText += `   GUID: ${df.guid}\n`;
              resultText += `   Active: ${df.active ? 'Yes' : 'No'}\n\n`;
            });
          } else {
            resultText += 'No datafeeds found.';
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting datafeeds: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_datafeed_history':
        try {
          const args = request.params.arguments as {
            datafeedGuid: string;
          };
          
          const history = await archerClient.getDatafeedHistory(args.datafeedGuid);
          
          let resultText = `Datafeed History for GUID: ${args.datafeedGuid}\n\n`;
          
          if (Array.isArray(history) && history.length > 0) {
            resultText += `Found ${history.length} run(s) in history\n\n`;
            
            // Show details for the most recent runs (first 5)
            const recentRuns = history.slice(0, 5);
            
            recentRuns.forEach((item: any, index: number) => {
              if (item.RequestedObject) {
                const run = item.RequestedObject;
                resultText += `Run ${index + 1}:\n`;
                resultText += `  History ID: ${run.Id}\n`;
                resultText += `  Status: ${run.Status === 2 ? 'Success' : run.Status === 3 ? 'Failed' : `Code ${run.Status}`}\n`;
                resultText += `  Start Time: ${run.StartTime || 'N/A'}\n`;
                resultText += `  End Time: ${run.EndTime || 'N/A'}\n`;
                resultText += `  Manual: ${run.WasManuallyStarted ? 'Yes' : 'No'}\n`;
                resultText += `  Records Processed: ${run.SourceRecordsProcessed || 0}\n`;
                
                if (run.TargetRecords) {
                  resultText += `  Target Records - Created: ${run.TargetRecords.Created}, Updated: ${run.TargetRecords.Updated}, Failed: ${run.TargetRecords.Failed}\n`;
                }
                
                if (run.ErrorMessage) {
                  resultText += `  Error: ${run.ErrorMessage}\n`;
                }
                
                resultText += '\n';
              }
            });
            
            if (history.length > 5) {
              resultText += `... and ${history.length - 5} more run(s) in history`;
            }
          } else {
            resultText += 'No history found for this datafeed.';
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting datafeed history: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_datafeed_history_messages':
        try {
          const args = request.params.arguments as {
            historyId: string | number;
          };
          
          const messages = await archerClient.getDatafeedHistoryMessages(args.historyId);
          
          let resultText = `Datafeed History Messages for History ID: ${args.historyId}\n\n`;
          
          if (messages) {
            // Check if it's a successful response with no messages
            if (messages.IsSuccessful === true && (!messages.ValidationMessages || messages.ValidationMessages.length === 0)) {
              resultText += '✅ Run completed successfully with no error messages.\n';
            } 
            // Check for validation messages
            else if (messages.ValidationMessages && Array.isArray(messages.ValidationMessages)) {
              resultText += `Found ${messages.ValidationMessages.length} message(s):\n\n`;
              
              messages.ValidationMessages.forEach((msg: any, index: number) => {
                resultText += `Message ${index + 1}:\n`;
                
                if (msg.Row !== undefined) {
                  resultText += `  Row: ${msg.Row}\n`;
                }
                
                if (msg.LocationMessage) {
                  resultText += `  Location: ${msg.LocationMessage}\n`;
                }
                
                if (msg.LocationParameters) {
                  resultText += `  Location Parameters: ${msg.LocationParameters}\n`;
                }
                
                if (msg.DatafeedMessage) {
                  resultText += `  Message: ${msg.DatafeedMessage}\n`;
                }
                
                if (msg.DatafeedMessageParameters) {
                  resultText += `  Message Parameters: ${msg.DatafeedMessageParameters}\n`;
                }
                
                if (msg.SeverityLevel !== undefined) {
                  resultText += `  Severity: ${msg.SeverityLevel}\n`;
                }
                
                if (msg.UpdateDate) {
                  resultText += `  Update Date: ${msg.UpdateDate}\n`;
                }
                
                if (msg.UpdateLoginName) {
                  resultText += `  Updated By: ${msg.UpdateLoginName}\n`;
                }
                
                resultText += '\n';
              });
            }
            // Handle other response formats
            else {
              resultText += 'Response received:\n';
              resultText += JSON.stringify(messages, null, 2);
            }
          } else {
            resultText += 'No messages found for this history ID.';
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting datafeed history messages: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'check_datafeed_health':
        try {
          const healthReport = await archerClient.checkDatafeedHealth();
          
          let resultText = `=== DATAFEED HEALTH CHECK REPORT ===\n\n`;
          resultText += `Total Active Datafeeds: ${healthReport.totalDatafeeds}\n\n`;
          
          if (healthReport.healthSummary) {
            resultText += `Health Summary:\n`;
            resultText += `✅ Healthy: ${healthReport.healthSummary.healthy}\n`;
            resultText += `⚠️  Warnings: ${healthReport.healthSummary.warnings}\n`;
            resultText += `❌ Failed: ${healthReport.healthSummary.failed}\n\n`;
          }
          
          if (healthReport.datafeeds && healthReport.datafeeds.length > 0) {
            resultText += `Detailed Status:\n`;
            resultText += `${'='.repeat(80)}\n`;
            
            // Group by health status
            const failed = healthReport.datafeeds.filter((df: any) => df.healthStatus === 'Failed');
            const warnings = healthReport.datafeeds.filter((df: any) => 
              ['Warning', 'Running', 'No Recent Runs', 'Error'].includes(df.healthStatus));
            const healthy = healthReport.datafeeds.filter((df: any) => df.healthStatus === 'Healthy');
            
            if (failed.length > 0) {
              resultText += `\n❌ FAILED DATAFEEDS (${failed.length}):\n`;
              failed.forEach((df: any) => {
                resultText += `\nName: ${df.name}\n`;
                resultText += `GUID: ${df.guid}\n`;
                resultText += `Status: ${df.runStatus || 'Unknown'}\n`;
                resultText += `Last Run: ${df.lastRunDate || 'Never'}\n`;
                if (df.errorMessage) {
                  resultText += `Error: ${df.errorMessage}\n`;
                }
              });
            }
            
            if (warnings.length > 0) {
              resultText += `\n⚠️  WARNINGS (${warnings.length}):\n`;
              warnings.forEach((df: any) => {
                resultText += `\nName: ${df.name}\n`;
                resultText += `GUID: ${df.guid}\n`;
                resultText += `Status: ${df.healthStatus}\n`;
                resultText += `Last Run: ${df.lastRunDate || 'Never'}\n`;
                if (df.error) {
                  resultText += `Error: ${df.error}\n`;
                }
              });
            }
            
            if (healthy.length > 0) {
              resultText += `\n✅ HEALTHY DATAFEEDS (${healthy.length}):\n`;
              healthy.forEach((df: any) => {
                resultText += `\nName: ${df.name}\n`;
                resultText += `Last Run: ${df.lastRunDate || 'Unknown'}\n`;
              });
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error checking datafeed health: ${error.message}`,
              },
            ],
          };
        }
        break;

      case 'get_security_events':
        try {
          const args = request.params.arguments as {
            instanceName: string;
            eventType?: string;
            eventsForDate: string;
          };
          
          const securityResults = await archerClient.getSecurityEvents(
            args.instanceName,
            args.eventType || 'all events',
            args.eventsForDate
          );
          
          let resultText = `=== ARCHER SECURITY EVENTS REPORT ===\n\n`;
          resultText += `Instance: ${securityResults.instanceName}\n`;
          resultText += `Event Type: ${securityResults.eventType}\n`;
          resultText += `Date: ${securityResults.eventsForDate}\n`;
          resultText += `Total Events: ${securityResults.totalEvents}\n`;
          resultText += `Request Time: ${securityResults.metadata.requestTime}\n\n`;
          
          if (securityResults.events && securityResults.events.length > 0) {
            resultText += `Security Events (Showing ${Math.min(securityResults.events.length, 20)} of ${securityResults.totalEvents}):\n`;
            resultText += `${'='.repeat(80)}\n\n`;
            
            // Show first 20 events for readability
            const eventsToShow = securityResults.events.slice(0, 20);
            
            eventsToShow.forEach((event: SecurityEvent, index: number) => {
              resultText += `Event ${index + 1}:\n`;
              resultText += `  Type: ${event.Event || 'Unknown'}\n`;
              resultText += `  User: ${event.InitiatingUser || 'Unknown'}\n`;
              resultText += `  Timestamp: ${event.Timestamp || 'Unknown'}\n`;
              resultText += `  Details: ${event.EventDetails || 'No details available'}\n`;
              resultText += '\n';
            });
            
            if (securityResults.totalEvents > 20) {
              resultText += `... and ${securityResults.totalEvents - 20} more events\n`;
              resultText += `\n💡 TIP: Use different date ranges or event types to filter results`;
            }
          } else {
            resultText += `No security events found for ${securityResults.eventsForDate}\n`;
            resultText += `\nTry:\n`;
            resultText += `- Different date (format: YYYY-MM-DD)\n`;
            resultText += `- Different event type\n`;
            resultText += `- Check if events exist for this instance`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting security events: ${error.message}`,
              },
            ],
          };
        }
        break;

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool: ${error.message}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('=== ARCHER MCP SERVER v6.1 STARTED ===');
  console.error('✅ Enhanced with Universal Data Transformation Framework');
  console.error('🔒 NEW: Security Events Reporting Support');
  console.error('🔄 Automatic alias → display name conversion for all applications');
  console.error('📊 Smart field type detection and formatting');
  console.error('🎯 Data quality analysis and insights');
  console.error(`Config - Base URL: ${archerConfig.baseUrl}`);
  console.error(`Config - Instance: ${archerConfig.instanceName}`);
  console.error(`Config - Username: ${archerConfig.username}`);
  console.error('=== SERVER READY ===');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});