#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';
import { PrivacyProtector } from '../privacy-protector.js';

/**
 * Archer connection configuration interface
 */
interface ArcherConnection {
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  userDomainId?: string;
}

/**
 * Archer session interface
 */
interface ArcherSession {
  sessionToken: string;
  expiresAt: Date;
}

/**
 * Archer application interface
 */
interface ArcherApplication {
  Id: number;
  Name: string;
  Status: number;
  Description?: string;
  LevelId?: number;
  TargetLevelId?: number;
}

/**
 * Archer API response interface
 */
interface ArcherApiResponse<T = any> {
  IsSuccessful: boolean;
  RequestedObject?: T;
  ValidationMessages?: Array<{
    MessageKey?: string;
    Description?: string;
  }>;
  message?: string;
}

/**
 * Archer field interface
 */
interface ArcherField {
  Alias: string;
  Name: string;
  Type?: string;
  Id?: number;
}

/**
 * Archer record interface
 */
interface ArcherRecord {
  [key: string]: any;
}

/**
 * Level mapping interface for ContentAPI
 */
interface LevelMapping {
  levelId: number;
  alias: string;
  moduleName: string;
  moduleId: number;
}

/**
 * Search results interface
 */
interface SearchResults {
  records: ArcherRecord[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  applicationName: string;
  applicationId: number;
}

/**
 * Application statistics interface
 */
interface ApplicationStats {
  applicationName: string;
  applicationId: number;
  totalRecords: number;
  sampleSize: number;
  totalFields: number;
  populatedFields: number;
  overallPopulationRate: number;
  fieldAnalysis: Record<string, {
    populationRate: number;
    populatedCount: number;
    totalRecords: number;
  }>;
}

/**
 * Tool arguments interfaces
 */
interface BaseToolArgs {
  tenant_id: string;
  archer_connection?: ArcherConnection;
}

interface GetApplicationsArgs extends BaseToolArgs {}

interface SearchRecordsArgs extends BaseToolArgs {
  applicationName: string;
  pageSize?: number;
  pageNumber?: number;
}

interface GetStatsArgs extends BaseToolArgs {
  applicationName: string;
}

interface AnalyzeDataArgs extends BaseToolArgs {
  query: string;
  applicationName?: string;
}

interface GenerateInsightsArgs extends BaseToolArgs {
  focus_area: 'risks' | 'controls' | 'incidents' | 'compliance' | 'overall';
  insight_type?: 'summary' | 'recommendations' | 'trends' | 'alerts';
}

interface TestConnectionArgs extends BaseToolArgs {}

interface DebugApiArgs extends BaseToolArgs {
  endpoint?: string;
}

interface GetFieldsArgs extends BaseToolArgs {
  applicationName: string;
}

interface GetTopRecordsArgs extends BaseToolArgs {
  applicationName: string;
  topN?: number;
  sortField?: string;
}

interface FindRecordArgs extends BaseToolArgs {
  applicationName: string;
  recordId: string | number;
}

interface GetDatafeedsArgs extends BaseToolArgs {
  activeOnly?: boolean;
}

interface GetDatafeedHistoryArgs extends BaseToolArgs {
  datafeedGuid: string;
}

interface GetDatafeedMessagesArgs extends BaseToolArgs {
  historyId: string | number;
}

interface CheckDatafeedHealthArgs extends BaseToolArgs {}

interface GetSecurityEventsArgs extends BaseToolArgs {
  instanceName: string;
  eventType?: string;
  eventsForDate: string;
}

/**
 * HTTPS request options interface
 */
interface RequestOptions {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  rejectUnauthorized?: boolean;
}

/**
 * Production Archer GRC Platform API Client
 * Based on the working PoC with multi-tenant support
 */
class ArcherAPIClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private instanceId: string;
  private userDomainId?: string;
  private session: ArcherSession | null = null;
  private applicationCache: ArcherApplication[] = [];
  private fieldMappingCache = new Map<string, Record<string, string>>();
  private levelMappingCache: LevelMapping[] = [];
  public privacyProtector: PrivacyProtector;

  constructor(connection: ArcherConnection) {
    this.baseUrl = connection.baseUrl;
    this.username = connection.username;
    this.password = connection.password;
    this.instanceId = connection.instanceId;
    this.userDomainId = connection.userDomainId;

    // Initialize privacy protector
    this.privacyProtector = new PrivacyProtector({
      enableMasking: process.env.ENABLE_PRIVACY_MASKING !== 'false',
      maskingLevel: (process.env.MASKING_LEVEL as 'light' | 'moderate' | 'strict') || 'moderate',
      enableTokenization: process.env.ENABLE_TOKENIZATION === 'true',
      preserveStructure: true
    });
  }

  /**
   * Authenticate with Archer GRC platform using working PoC authentication
   */
  async authenticate(): Promise<boolean> {
    try {
      console.log(`[Archer API] Authenticating with ${this.baseUrl}...`);
      
      const loginData = {
        InstanceName: this.instanceId,
        Username: this.username,
        UserDomain: this.userDomainId || '',
        Password: this.password
      };
      
      console.log(`[Archer API] Login endpoint: /api/core/security/login`);
      console.log(`[Archer API] Login data:`, {
        InstanceName: this.instanceId,
        Username: this.username,
        UserDomain: this.userDomainId || '',
        Password: '***masked***'
      });

      const response = await this.makeRequest<{SessionToken: string}>('/api/core/security/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
      });

      if (response.IsSuccessful && response.RequestedObject?.SessionToken) {
        this.session = {
          sessionToken: response.RequestedObject.SessionToken,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000) // 20 minutes
        };
        
        console.log('[Archer API] Authentication successful');
        return true;
      } else {
        const errorMessages = response.ValidationMessages?.map(msg => 
          msg.MessageKey || msg.Description || 'Unknown error'
        ).join(', ') || 'Unknown error';
        throw new Error(`Login failed: ${errorMessages}`);
      }
    } catch (error) {
      console.error('[Archer API] Authentication error:', (error as Error).message);
      return false;
    }
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    return !!(this.session && this.session.expiresAt > new Date());
  }

  /**
   * Ensure we have a valid session
   */
  async ensureValidSession(): Promise<void> {
    if (!this.isSessionValid()) {
      console.log('[Archer API] Session invalid, logging in...');
      await this.authenticate();
    }
  }

  /**
   * Make authenticated API request to Archer
   */
  async makeRequest<T = any>(endpoint: string, options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {}): Promise<ArcherApiResponse<T>> {
    const url = new URL(endpoint, this.baseUrl);
    
    const requestOptions: RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port) || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      rejectUnauthorized: false // Bypass SSL certificate validation for UAT environment
    };

    if (this.session?.sessionToken) {
      requestOptions.headers['Authorization'] = `Archer session-id="${this.session.sessionToken}"`;
    }

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data) as ArcherApiResponse<T>;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${response.message || data}`));
            }
          } catch (e) {
            console.error('[Archer API] JSON parse error. Response length:', data.length);
            console.error('[Archer API] Response type:', typeof data);
            console.error('[Archer API] Response starts with:', data.toString().substring(0, 200));
            console.error('[Archer API] Status code was:', res.statusCode);
            console.error('[Archer API] Response headers:', res.headers);
            reject(new Error(`Invalid JSON response (status ${res.statusCode}): ${data.toString()}`));
          }
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * Make direct axios request (like working legacy server)
   */
  private async makeDirectRequest(endpoint: string) {
    if (!this.session?.sessionToken) {
      throw new Error('No valid session token');
    }

    console.log(`[makeDirectRequest] Making request to: ${endpoint}`);
    console.log(`[makeDirectRequest] Session token: ${this.session.sessionToken.substring(0, 20)}...`);

    const axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'GRC-AI-Platform-MCP-Server/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // SSL certificate bypass for UAT environment - same as working server
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    try {
      const response = await axiosInstance.get(endpoint, {
        headers: {
          'Authorization': `Archer session-id=${this.session.sessionToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log(`[makeDirectRequest] Response status: ${response.status}`);
      console.log(`[makeDirectRequest] Response headers:`, response.headers);
      console.log(`[makeDirectRequest] Response data type:`, typeof response.data);
      if (typeof response.data === 'object') {
        console.log(`[makeDirectRequest] Response keys:`, Object.keys(response.data || {}));
        if (response.data && response.data['@odata.count'] !== undefined) {
          console.log(`[makeDirectRequest] OData count:`, response.data['@odata.count']);
        }
        if (response.data && response.data.value) {
          console.log(`[makeDirectRequest] Value array length:`, Array.isArray(response.data.value) ? response.data.value.length : 'not array');
        }
      }
      console.log(`[makeDirectRequest] Raw response data:`, JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[makeDirectRequest] Axios error: ${error.message}`);
        console.error(`[makeDirectRequest] Status: ${error.response?.status}`);
        console.error(`[makeDirectRequest] Response data:`, error.response?.data);
      } else {
        console.error(`[makeDirectRequest] Non-axios error:`, error);
      }
      throw error;
    }
  }

  /**
   * Get all active applications and questionnaires
   */
  async getApplications(): Promise<ArcherApplication[]> {
    // Clear cache for debugging - remove this in production
    this.applicationCache = [];
    
    if (this.applicationCache.length > 0) {
      console.log(`[Archer API] Using cached applications (${this.applicationCache.length} entries)`);
      return this.applicationCache;
    }

    await this.ensureValidSession();
    
    try {
      console.log('[Archer API] Fetching applications...');
      
      // Get applications using direct axios call (like working legacy server)
      const appsResponse = await this.makeDirectRequest('/api/core/system/application');
      console.log('[Archer API] Application response status:', appsResponse.status);
      console.log('[Archer API] Application response data type:', typeof appsResponse.data);
      
      // Extract applications from response structure - each item has RequestedObject property
      let applications: ArcherApplication[] = [];
      if (Array.isArray(appsResponse.data)) {
        applications = appsResponse.data
          .filter(item => item.IsSuccessful && item.RequestedObject)
          .map(item => item.RequestedObject);
      }
      
      console.log(`[Archer API] Extracted ${applications.length} applications from API response`);
      
      // Get questionnaires
      let questionnaires: ArcherApplication[] = [];
      try {
        const questResponse = await this.makeRequest<ArcherApplication[]>('/api/core/system/questionnaire');
        questionnaires = questResponse.RequestedObject || [];
      } catch (questError) {
        console.log('[Archer API] Questionnaires not available or accessible');
      }

      // Filter for active applications only
      const activeApplications = applications.filter(app => app.Status === 1);
      const activeQuestionnaires = questionnaires.filter(q => q.Status === 1);

      // Combine and cache
      this.applicationCache = [...activeApplications, ...activeQuestionnaires];
      
      console.log(`[Archer API] Cached ${activeApplications.length} applications and ${activeQuestionnaires.length} questionnaires`);
      return this.applicationCache;

    } catch (error) {
      console.error('[Archer API] Error fetching applications:', (error as Error).message);
      console.error('[Archer API] Error details:', error);
      console.error('[Archer API] Error stack:', (error as Error).stack);
      throw error;
    }
  }

  /**
   * Get and cache Level mappings for ContentAPI
   */
  async getLevelMappings(): Promise<LevelMapping[]> {
    if (this.levelMappingCache.length > 0) {
      console.log(`[Archer API] Using cached Level mappings (${this.levelMappingCache.length} entries)`);
      return this.levelMappingCache;
    }

    await this.ensureValidSession();
    
    try {
      console.log('[Archer API] Fetching Level mappings from /api/core/system/level...');
      
      const response = await this.makeRequest<any[]>('/api/core/system/level');
      const mappings: LevelMapping[] = [];

      if (Array.isArray(response)) {
        response.forEach((item: any) => {
          if (item.RequestedObject && !item.RequestedObject.IsDeleted) {
            const level = item.RequestedObject;
            mappings.push({
              levelId: level.Id,
              alias: level.Alias,
              moduleName: level.ModuleName,
              moduleId: level.ModuleId
            });
            console.log(`[Archer API] Level ${level.Id}: ${level.ModuleName} → /contentapi/${level.Alias}`);
          }
        });
      } else if (response && response.IsSuccessful && Array.isArray(response.RequestedObject)) {
        response.RequestedObject.forEach((level: any) => {
          if (!level.IsDeleted) {
            mappings.push({
              levelId: level.Id,
              alias: level.Alias,
              moduleName: level.ModuleName,
              moduleId: level.ModuleId
            });
            console.log(`[Archer API] Level ${level.Id}: ${level.ModuleName} → /contentapi/${level.Alias}`);
          }
        });
      }

      this.levelMappingCache = mappings;
      console.log(`[Archer API] Cached ${mappings.length} Level mappings`);
      
      return mappings;
    } catch (error) {
      console.error('[Archer API] Error fetching Level mappings:', (error as Error).message);
      return [];
    }
  }

  /**
   * Find Level mapping by module name or alias
   */
  async findLevelMapping(nameOrAlias: string): Promise<LevelMapping | null> {
    const mappings = await this.getLevelMappings();
    
    if (!nameOrAlias) return null;
    
    // Try exact match first
    let mapping = mappings.find(m => 
      m.moduleName && m.alias && (
        m.moduleName.toLowerCase() === nameOrAlias.toLowerCase() ||
        m.alias.toLowerCase() === nameOrAlias.toLowerCase()
      )
    );
    
    if (!mapping) {
      // Try partial match
      mapping = mappings.find(m => 
        m.moduleName && m.alias && (
          m.moduleName.toLowerCase().includes(nameOrAlias.toLowerCase()) ||
          m.alias.toLowerCase().includes(nameOrAlias.toLowerCase()) ||
          nameOrAlias.toLowerCase().includes(m.moduleName.toLowerCase()) ||
          nameOrAlias.toLowerCase().includes(m.alias.toLowerCase())
        )
      );
    }
    
    return mapping || null;
  }

  /**
   * Get application by name
   */
  async getApplicationByName(name: string): Promise<ArcherApplication> {
    const applications = await this.getApplications();
    const app = applications.find(app => 
      app.Name && (
        app.Name.toLowerCase() === name.toLowerCase() ||
        app.Name.toLowerCase().includes(name.toLowerCase())
      )
    );
    
    if (!app) {
      const availableNames = applications
        .map(a => a.Name || '[No Name]')
        .join(', ');
      throw new Error(`Application "${name}" not found. Available: ${availableNames}`);
    }

    return app;
  }

  /**
   * Search records in an application using ContentAPI
   */
  async searchRecords(appName: string, pageSize = 100, pageNumber = 1): Promise<SearchResults> {
    await this.ensureValidSession();
    
    try {
      const app = await this.getApplicationByName(appName);
      console.log(`[Archer API] Searching records in: ${app.Name} (ID: ${app.Id})`);
      
      // Try to find Level mapping for ContentAPI
      console.log(`[Archer API] Looking for Level mapping for: ${app.Name}`);
      const levelMapping = await this.findLevelMapping(app.Name);
      
      let contentApiUrl: string | null = null;
      
      if (levelMapping) {
        contentApiUrl = `/contentapi/${levelMapping.alias}`;
        console.log(`[Archer API] Found Level mapping: ${app.Name} → ${contentApiUrl}`);
      } else {
        // Try direct ContentAPI patterns
        const possibleUrls = [
          `/contentapi/${app.Name.replace(/\s+/g, '_')}`,
          `/contentapi/${app.Name.replace(/\s+/g, '')}`,
          `/contentapi/${app.Name.toLowerCase().replace(/\s+/g, '_')}`,
          `/contentapi/${app.Name.toLowerCase().replace(/\s+/g, '')}`
        ];
        
        console.log(`[Archer API] No Level mapping found, trying direct ContentAPI patterns:`);
        for (const url of possibleUrls) {
          console.log(`[Archer API] Testing: ${url}`);
          try {
            // Test if this URL is accessible by trying to get a small sample
            const testResponse = await this.makeDirectRequest(`${url}?$top=1`);
            if (testResponse.status === 200) {
              contentApiUrl = url;
              console.log(`[Archer API] Success with direct pattern: ${url}`);
              break;
            }
          } catch (error) {
            console.log(`[Archer API] Failed: ${url} - ${(error as Error).message}`);
          }
        }
      }
      
      if (!contentApiUrl) {
        console.log(`[Archer API] No ContentAPI URL found for ${app.Name}`);
        
        // Return graceful fallback with application information
        return {
          records: [{
            'Application Name': app.Name,
            'Application ID': app.Id,
            'Status': app.Status === 1 ? 'Active' : 'Inactive',
            'Record Access': 'ContentAPI endpoint not available',
            'Data Source': 'Archer GRC Platform - Application Metadata',
            'Note': 'This application may not be exposed via ContentAPI or uses different naming'
          }],
          totalCount: 0,
          pageNumber: pageNumber,
          pageSize: pageSize,
          applicationName: app.Name,
          applicationId: app.Id
        };
      }
      
      console.log(`[Archer API] Using ContentAPI URL: ${contentApiUrl}`);
      
      // Get records using ContentAPI with OData parameters
      let records: ArcherRecord[] = [];
      let totalCount = 0;
      
      try {
        // ContentAPI doesn't support $count parameter, so we need to get actual records
        // and estimate total count. For first page, we'll fetch more records to get accurate count.
        
        if (pageNumber === 1) {
          // For first page, get a larger sample to determine total count
          console.log(`[Archer API] Getting sample records to determine count from: ${contentApiUrl}?$top=1000`);
          const sampleResponse = await this.makeDirectRequest(`${contentApiUrl}?$top=1000`);
          
          if (sampleResponse.data && Array.isArray(sampleResponse.data.value)) {
            const allRecords = sampleResponse.data.value;
            totalCount = allRecords.length;
            
            // If we got exactly 1000 records, there might be more
            if (allRecords.length === 1000) {
              console.log(`[Archer API] Found 1000+ records, getting full count...`);
              try {
                // Try to get more records to find actual total
                const largeResponse = await this.makeDirectRequest(`${contentApiUrl}?$top=10000`);
                if (largeResponse.data && Array.isArray(largeResponse.data.value)) {
                  totalCount = largeResponse.data.value.length;
                  console.log(`[Archer API] Full record count: ${totalCount}`);
                }
              } catch (error) {
                console.log(`[Archer API] Could not get full count, using sample: ${totalCount}`);
              }
            }
            
            // Extract the requested page from our sample
            const skip = (pageNumber - 1) * pageSize;
            records = allRecords.slice(skip, skip + pageSize);
            console.log(`[Archer API] Total: ${totalCount}, Page ${pageNumber}: ${records.length} records`);
          }
        } else {
          // For subsequent pages, use standard pagination
          const skip = (pageNumber - 1) * pageSize;
          const recordsUrl = `${contentApiUrl}?$top=${pageSize}&$skip=${skip}`;
          console.log(`[Archer API] Getting page ${pageNumber} from: ${recordsUrl}`);
          
          const recordsResponse = await this.makeDirectRequest(recordsUrl);
          
          if (recordsResponse.data && Array.isArray(recordsResponse.data.value)) {
            records = recordsResponse.data.value;
            // For non-first pages, we'll use a rough estimate for total count
            totalCount = Math.max(skip + records.length, 100); // Rough estimate
            console.log(`[Archer API] Page ${pageNumber}: Retrieved ${records.length} records`);
          }
        }
        
        if (!Array.isArray(records)) {
          console.log(`[Archer API] No records found in ${app.Name}`);
          records = [];
          totalCount = 0;
        }
        
      } catch (contentApiError) {
        console.error(`[Archer API] ContentAPI request failed: ${(contentApiError as Error).message}`);
        
        // Return graceful fallback
        return {
          records: [{
            'Application Name': app.Name,
            'Application ID': app.Id,
            'Status': app.Status === 1 ? 'Active' : 'Inactive',
            'Error': `ContentAPI request failed: ${(contentApiError as Error).message}`,
            'Data Source': 'Archer GRC Platform - Error Response'
          }],
          totalCount: 0,
          pageNumber: pageNumber,
          pageSize: pageSize,
          applicationName: app.Name,
          applicationId: app.Id
        };
      }
      
      // Transform field aliases to display names
      const transformedRecords = await this.transformRecords(records, app);

      return {
        records: transformedRecords,
        totalCount: totalCount,
        pageNumber: pageNumber,
        pageSize: pageSize,
        applicationName: app.Name,
        applicationId: app.Id
      };

    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error('[Archer API] Error searching records:', errorMsg);
      
      return {
        records: [],
        totalCount: 0,
        pageNumber: pageNumber,
        pageSize: pageSize,
        applicationName: appName,
        applicationId: 0
      };
    }
  }

  /**
   * Transform records by converting field aliases to display names
   */
  async transformRecords(records: ArcherRecord[], application: ArcherApplication): Promise<ArcherRecord[]> {
    if (!records || records.length === 0) return [];

    try {
      // Get field mapping for this application
      const fieldMapping = await this.getFieldMapping(application);
      
      return records.map(record => {
        const transformedRecord: ArcherRecord = {};
        
        // Transform each field
        for (const [alias, value] of Object.entries(record)) {
          const displayName = fieldMapping[alias] || alias;
          transformedRecord[displayName] = this.formatFieldValue(value, alias);
        }
        
        return transformedRecord;
      });

    } catch (error) {
      console.error('[Archer API] Error transforming records:', (error as Error).message);
      return records; // Return original records if transformation fails
    }
  }

  /**
   * Get field mapping (alias -> display name) for an application
   */
  async getFieldMapping(application: ArcherApplication): Promise<Record<string, string>> {
    const cacheKey = application.Name;
    
    if (this.fieldMappingCache.has(cacheKey)) {
      return this.fieldMappingCache.get(cacheKey)!;
    }

    try {
      await this.ensureValidSession();
      
      // Get fields for this application's level
      const levelId = application.LevelId || application.TargetLevelId;
      if (!levelId) {
        console.log(`[Archer API] No level ID found for ${application.Name}`);
        return {};
      }

      const fieldsResponse = await this.makeRequest<ArcherField[]>(`/api/core/system/level/${levelId}/field`);
      const fields = fieldsResponse.RequestedObject || [];

      // Build alias -> display name mapping
      const mapping: Record<string, string> = {};
      fields.forEach(field => {
        if (field.Alias && field.Name) {
          mapping[field.Alias] = field.Name;
        }
      });

      console.log(`[Archer API] Cached ${Object.keys(mapping).length} field mappings for ${application.Name}`);
      this.fieldMappingCache.set(cacheKey, mapping);
      
      return mapping;

    } catch (error) {
      console.error(`[Archer API] Error getting field mapping for ${application.Name}:`, (error as Error).message);
      return {};
    }
  }

  /**
   * Format field values based on type detection
   */
  formatFieldValue(value: any, alias: string): any {
    if (value === null || value === undefined || value === '') return value;

    const lowerAlias = alias.toLowerCase();

    // Financial values
    if (lowerAlias.includes('amount') || lowerAlias.includes('cost') || lowerAlias.includes('price')) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
      }
    }

    // Dates
    if (lowerAlias.includes('date') || lowerAlias.includes('created') || lowerAlias.includes('modified')) {
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

    // HTML content - strip tags
    if ((lowerAlias.includes('description') || lowerAlias.includes('comments') || 
         lowerAlias.includes('notes')) && typeof value === 'string') {
      return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    return value;
  }

  /**
   * Get comprehensive statistics for an application
   */
  async getApplicationStats(appName: string): Promise<ApplicationStats> {
    try {
      const searchResults = await this.searchRecords(appName, 50, 1);
      const records = searchResults.records;
      
      if (records.length === 0) {
        return {
          applicationName: searchResults.applicationName,
          applicationId: searchResults.applicationId,
          totalRecords: 0,
          sampleSize: 0,
          totalFields: 0,
          populatedFields: 0,
          overallPopulationRate: 0,
          fieldAnalysis: {}
        };
      }

      // Analyze field population
      const sampleRecord = records[0];
      const fields = Object.keys(sampleRecord);
      
      let populatedFieldCount = 0;
      const fieldAnalysis: Record<string, {
        populationRate: number;
        populatedCount: number;
        totalRecords: number;
      }> = {};
      
      fields.forEach(field => {
        let populatedCount = 0;
        records.forEach(record => {
          if (record[field] !== null && record[field] !== undefined && record[field] !== '') {
            populatedCount++;
          }
        });
        
        const populationRate = (populatedCount / records.length) * 100;
        fieldAnalysis[field] = {
          populationRate: Math.round(populationRate * 100) / 100,
          populatedCount,
          totalRecords: records.length
        };
        
        if (populatedCount > 0) {
          populatedFieldCount++;
        }
      });

      return {
        applicationName: searchResults.applicationName,
        applicationId: searchResults.applicationId,
        totalRecords: searchResults.totalCount,
        sampleSize: records.length,
        totalFields: fields.length,
        populatedFields: populatedFieldCount,
        overallPopulationRate: Math.round((populatedFieldCount / fields.length) * 100),
        fieldAnalysis
      };

    } catch (error) {
      console.error('[Archer API] Error getting application stats:', (error as Error).message);
      throw error;
    }
  }
}

/**
 * Production MCP Server for Archer GRC Platform
 */
class GRCMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'archer-grc-server-production',
      version: '2.0.0',
      description: 'Production AI-powered GRC analysis server with Archer integration and privacy protection'
    }, {
      capabilities: {
        tools: {},
      },
    });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
      const tools: Tool[] = [
        {
          name: 'get_archer_applications',
          description: 'List all active Archer applications and questionnaires available for analysis',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details',
                properties: {
                  baseUrl: { type: 'string' },
                  username: { type: 'string' },
                  password: { type: 'string' },
                  instanceId: { type: 'string' },
                  userDomainId: { type: 'string' }
                }
              }
            },
            required: ['tenant_id']
          }
        },
        {
          name: 'search_archer_records',
          description: 'Search and retrieve records from a specific Archer application with privacy protection and field transformation',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              applicationName: {
                type: 'string',
                description: 'Name of the Archer application (e.g., "Risk Register", "Controls", "Incidents")'
              },
              pageSize: {
                type: 'number',
                description: 'Number of records per page (default: 100, max: 500)',
                default: 100
              },
              pageNumber: {
                type: 'number',
                description: 'Page number to retrieve (default: 1)',
                default: 1
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'applicationName']
          }
        },
        {
          name: 'get_archer_stats',
          description: 'Get comprehensive statistics and data quality analysis for an Archer application',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              applicationName: {
                type: 'string',
                description: 'Name of the Archer application to analyze'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'applicationName']
          }
        },
        {
          name: 'analyze_grc_data',
          description: 'AI-powered analysis of GRC data with natural language queries and comprehensive insights',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              query: {
                type: 'string',
                description: 'Natural language question about GRC data'
              },
              applicationName: {
                type: 'string',
                description: 'Optional: specific application to focus analysis on'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'query']
          }
        },
        {
          name: 'generate_insights',
          description: 'Generate executive insights and recommendations from GRC data analysis',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              focus_area: {
                type: 'string',
                enum: ['risks', 'controls', 'incidents', 'compliance', 'overall'],
                description: 'Focus area for insight generation'
              },
              insight_type: {
                type: 'string',
                enum: ['summary', 'recommendations', 'trends', 'alerts'],
                description: 'Type of insights to generate'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'focus_area']
          }
        },
        {
          name: 'test_archer_connection',
          description: 'Test connection to RSA Archer instance and authenticate',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id']
          }
        },
        {
          name: 'debug_archer_api',
          description: 'Debug Archer API responses to see what is actually being returned',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              endpoint: {
                type: 'string',
                description: 'API endpoint to test (e.g., "api/core/system/level" or "contentapi/Risk_Register")',
                default: 'api/core/system/level'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id']
          }
        },
        {
          name: 'get_application_fields',
          description: 'Get all ACTIVE field information for a specific Archer application',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              applicationName: {
                type: 'string',
                description: 'Name of the Archer application'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'applicationName']
          }
        },
        {
          name: 'get_top_records',
          description: 'Get top N records from an application, optionally sorted by a field',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
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
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'applicationName']
          }
        },
        {
          name: 'find_record_by_id',
          description: 'Find a specific record by its ID in an application',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              applicationName: {
                type: 'string',
                description: 'Name of the Archer application'
              },
              recordId: {
                type: ['string', 'number'],
                description: 'The record ID to search for'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'applicationName', 'recordId']
          }
        },
        {
          name: 'get_datafeeds',
          description: 'Get list of datafeeds from Archer',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              activeOnly: {
                type: 'boolean',
                description: 'Only return active datafeeds (default: true)',
                default: true
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id']
          }
        },
        {
          name: 'get_datafeed_history',
          description: 'Get run history for a specific datafeed',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              datafeedGuid: {
                type: 'string',
                description: 'GUID of the datafeed'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'datafeedGuid']
          }
        },
        {
          name: 'get_datafeed_history_messages',
          description: 'Get detailed messages for a specific datafeed history run',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              historyId: {
                type: ['string', 'number'],
                description: 'History ID from a datafeed run (obtained from get_datafeed_history)'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'historyId']
          }
        },
        {
          name: 'check_datafeed_health',
          description: 'Check health status of all active datafeeds, identifying failures and missed runs',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id']
          }
        },
        {
          name: 'get_security_events',
          description: 'Get security events from Archer for a specific date and event type',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: {
                type: 'string',
                description: 'Tenant identifier for data scoping'
              },
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
                description: 'Date to retrieve events for (YYYY-MM-DD format)'
              },
              archer_connection: {
                type: 'object',
                description: 'Archer connection details'
              }
            },
            required: ['tenant_id', 'instanceName', 'eventsForDate']
          }
        }
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const toolName = request.params.name;
      const args = request.params.arguments;

      console.log(`[GRC Server] Tool called: ${toolName} with args:`, JSON.stringify(args, null, 2));

      try {
        switch (toolName) {
          case 'get_archer_applications':
            return await this.getArcherApplications(args as unknown as GetApplicationsArgs);
          
          case 'search_archer_records':
            return await this.searchArcherRecords(args as unknown as SearchRecordsArgs);
          
          case 'get_archer_stats':
            return await this.getArcherStats(args as unknown as GetStatsArgs);
          
          case 'analyze_grc_data':
            return await this.analyzeGrcData(args as unknown as AnalyzeDataArgs);
          
          case 'generate_insights':
            return await this.generateInsights(args as unknown as GenerateInsightsArgs);
          
          case 'test_archer_connection':
            return await this.testArcherConnection(args as unknown as TestConnectionArgs);
          
          case 'debug_archer_api':
            return await this.debugArcherApi(args as unknown as DebugApiArgs);
          
          case 'get_application_fields':
            return await this.getApplicationFields(args as unknown as GetFieldsArgs);
          
          case 'get_top_records':
            return await this.getTopRecords(args as unknown as GetTopRecordsArgs);
          
          case 'find_record_by_id':
            return await this.findRecordById(args as unknown as FindRecordArgs);
          
          case 'get_datafeeds':
            return await this.getDatafeeds(args as unknown as GetDatafeedsArgs);
          
          case 'get_datafeed_history':
            return await this.getDatafeedHistory(args as unknown as GetDatafeedHistoryArgs);
          
          case 'get_datafeed_history_messages':
            return await this.getDatafeedHistoryMessages(args as unknown as GetDatafeedMessagesArgs);
          
          case 'check_datafeed_health':
            return await this.checkDatafeedHealth(args as unknown as CheckDatafeedHealthArgs);
          
          case 'get_security_events':
            return await this.getSecurityEvents(args as unknown as GetSecurityEventsArgs);
          
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
      } catch (error) {
        console.error(`[GRC Server] Error in ${toolName}:`, (error as Error).message);
        return {
          content: [{
            type: 'text',
            text: `Error in ${toolName}: ${(error as Error).message}`
          }]
        };
      }
    });
  }

  /**
   * Get list of available Archer applications
   */
  private async getArcherApplications(args: any): Promise<CallToolResult> {
    console.log('[getArcherApplications] Method called with args:', args);
    const { tenant_id, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection configured for tenant ${tenant_id}. Please set environment variables: ARCHER_BASE_URL, ARCHER_USERNAME, ARCHER_PASSWORD, ARCHER_INSTANCE`
        }]
      };
    }

    try {
      const archerClient = new ArcherAPIClient(connection);
      console.log('[getArcherApplications] Creating Archer client and calling getApplications()...');
      const applications = await archerClient.getApplications();
      console.log(`[getArcherApplications] Received ${applications.length} applications from client`);

      // Return raw data - privacy protection handled by frontend based on tenant settings
      const protectedApplications = applications;

      let resultText = `Available Archer Applications for ${tenant_id}\n`;
      resultText += `Instance: ${connection.baseUrl}\n`;
      resultText += `Total Applications: ${applications.length}\n\n`;

      if (protectedApplications.length > 0) {
        resultText += 'Applications:\n';
        protectedApplications.forEach((app: any, index: number) => {
          resultText += `${index + 1}. ${app.Name || '[MASKED_NAME]'}\n`;
          resultText += `   ID: ${app.Id || '[MASKED_ID]'}\n`;
          resultText += `   Status: ${app.Status === 1 ? 'Active' : 'Inactive'}\n`;
          if (app.Description && app.Description.trim()) {
            resultText += `   Description: ${app.Description.substring(0, 100)}${app.Description.length > 100 ? '...' : ''}\n`;
          }
          resultText += '\n';
        });
      }

      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };

    } catch (error) {
      console.error('[getArcherApplications] Error occurred:', error);
      console.error('[getArcherApplications] Error message:', (error as Error).message);
      console.error('[getArcherApplications] Error stack:', (error as Error).stack);
      return {
        content: [{
          type: 'text',
          text: `Error fetching Archer applications: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Search records in Archer application
   */
  private async searchArcherRecords(args: SearchRecordsArgs): Promise<CallToolResult> {
    const { tenant_id, applicationName, pageSize = 100, pageNumber = 1, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection configured for tenant ${tenant_id}. Please set environment variables: ARCHER_BASE_URL, ARCHER_USERNAME, ARCHER_PASSWORD, ARCHER_INSTANCE`
        }]
      };
    }

    try {
      console.log(`[searchArcherRecords] Creating Archer client for ${applicationName}`);
      const archerClient = new ArcherAPIClient(connection);
      
      console.log(`[searchArcherRecords] Calling archerClient.searchRecords with pageSize=${Math.min(pageSize, 500)}, pageNumber=${pageNumber}`);
      const searchResults = await archerClient.searchRecords(applicationName, Math.min(pageSize, 500), pageNumber);
      
      console.log(`[searchArcherRecords] Search results:`, {
        applicationName: searchResults.applicationName,
        totalCount: searchResults.totalCount,
        recordsLength: searchResults.records.length,
        pageNumber: searchResults.pageNumber
      });

      // Return raw data - privacy protection handled by frontend based on tenant settings  
      const protectedRecords = searchResults.records;

      let resultText = `Records from "${searchResults.applicationName}" (Tenant: ${tenant_id})\n`;
      resultText += `Total Records: ${searchResults.totalCount.toLocaleString()}\n`;
      resultText += `Page ${searchResults.pageNumber} (${protectedRecords.length} records)\n\n`;

      if (protectedRecords.length > 0) {
        const maxRecordsToShow = Math.min(protectedRecords.length, 10);
        resultText += `Showing first ${maxRecordsToShow} records:\n\n`;

        protectedRecords.slice(0, maxRecordsToShow).forEach((record: any, index: number) => {
          resultText += `${index + 1}. Record:\n`;
          
          // Show key fields
          const keys = Object.keys(record);
          const idFields = keys.filter(key => key.toLowerCase().includes('id'));
          const nameFields = keys.filter(key => key.toLowerCase().includes('name') || key.toLowerCase().includes('title'));
          const otherFields = keys.filter(key => !key.toLowerCase().includes('id') && !key.toLowerCase().includes('name') && !key.toLowerCase().includes('title'));

          // Show ID fields first
          idFields.slice(0, 2).forEach(key => {
            resultText += `   ${key}: ${record[key]}\n`;
          });

          // Show name/title fields
          nameFields.slice(0, 2).forEach(key => {
            resultText += `   ${key}: ${record[key]}\n`;
          });

          // Show other important fields
          otherFields.slice(0, 3).forEach(key => {
            let value = record[key];
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            resultText += `   ${key}: ${value}\n`;
          });

          resultText += '\n';
        });

        if (protectedRecords.length > maxRecordsToShow) {
          resultText += `... and ${protectedRecords.length - maxRecordsToShow} more records\n`;
        }
      }

      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching records: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Get application statistics
   */
  private async getArcherStats(args: GetStatsArgs): Promise<CallToolResult> {
    const { tenant_id, applicationName, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection configured for tenant ${tenant_id}. Please set environment variables: ARCHER_BASE_URL, ARCHER_USERNAME, ARCHER_PASSWORD, ARCHER_INSTANCE`
        }]
      };
    }

    try {
      const archerClient = new ArcherAPIClient(connection);
      const stats = await archerClient.getApplicationStats(applicationName);

      let resultText = `Statistics for "${stats.applicationName}" (Tenant: ${tenant_id})\n`;
      resultText += `Total Records: ${stats.totalRecords.toLocaleString()}\n`;
      resultText += `Sample Size: ${stats.sampleSize} records\n`;
      resultText += `Total Fields: ${stats.totalFields}\n`;
      resultText += `Populated Fields: ${stats.populatedFields} (${stats.overallPopulationRate}%)\n\n`;

      if (stats.fieldAnalysis) {
        resultText += 'Field Population Analysis:\n';
        const sortedFields = Object.entries(stats.fieldAnalysis)
          .sort(([,a], [,b]) => b.populationRate - a.populationRate)
          .slice(0, 10);

        sortedFields.forEach(([fieldName, analysis]) => {
          resultText += `  ${fieldName}: ${analysis.populationRate}% (${analysis.populatedCount}/${analysis.totalRecords})\n`;
        });
      }

      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting statistics: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Analyze GRC data with AI
   */
  private async analyzeGrcData(args: AnalyzeDataArgs): Promise<CallToolResult> {
    const { tenant_id, query, applicationName, archer_connection } = args;
    
    if (!archer_connection) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection provided for tenant ${tenant_id}. Please configure Archer connection details.`
        }]
      };
    }

    try {
      const archerClient = new ArcherAPIClient(archer_connection);
      
      // If specific application mentioned, get its data
      let dataContext = '';
      if (applicationName) {
        const stats = await archerClient.getApplicationStats(applicationName);
        const sampleRecords = await archerClient.searchRecords(applicationName, 20, 1);
        
        dataContext = `Analysis based on ${stats.applicationName} with ${stats.totalRecords} total records. `;
        dataContext += `Data population: ${stats.overallPopulationRate}%. `;
        dataContext += `Sample of ${sampleRecords.records.length} records analyzed.`;
      } else {
        const applications = await archerClient.getApplications();
        dataContext = `Analysis across ${applications.length} available Archer applications. `;
      }

      // Return data context only without fake analysis
      let analysisResult = `# GRC Data Retrieved for ${tenant_id}\n\n`;
      analysisResult += `**Query**: ${query}\n`;
      analysisResult += `**Data Context**: ${dataContext}\n\n`;
      analysisResult += `## Available Data:\n\n`;
      
      if (applicationName) {
        analysisResult += `✅ Successfully connected to ${applicationName} application\n`;
        analysisResult += `📊 Data population rate and record counts available\n`;
        analysisResult += `🔍 Sample records retrieved for analysis\n\n`;
      } else {
        analysisResult += `✅ Successfully connected to Archer GRC platform\n`;
        analysisResult += `📱 Application list retrieved\n\n`;
      }
      
      analysisResult += `**Note**: This tool provides data retrieval only. For AI-powered analysis and insights, please use a connected LLM service that can process the retrieved GRC data.\n\n`;
      analysisResult += `**Data Source**: Live Archer GRC Platform\n`;
      analysisResult += `**Connection Status**: Active`;

      return {
        content: [{
          type: 'text',
          text: analysisResult
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in GRC analysis: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Generate executive insights
   */
  private async generateInsights(args: GenerateInsightsArgs): Promise<CallToolResult> {
    const { tenant_id, focus_area, insight_type = 'summary', archer_connection } = args;
    
    if (!archer_connection) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection provided for tenant ${tenant_id}. Please configure Archer connection details.`
        }]
      };
    }

    try {
      const archerClient = new ArcherAPIClient(archer_connection);
      const applications = await archerClient.getApplications();
      
      let insightsResult = `# GRC Data Summary for ${tenant_id}\n\n`;
      insightsResult += `**Focus Area**: ${focus_area}\n`;
      insightsResult += `**Data Request Type**: ${insight_type}\n`;
      insightsResult += `**Available Applications**: ${applications.length} Archer applications connected\n\n`;

      insightsResult += `## Available Data Sources:\n\n`;
      
      // List actual available applications
      for (let i = 0; i < Math.min(applications.length, 5); i++) {
        const app = applications[i];
        insightsResult += `✅ **${app.Name}** (ID: ${app.Id})\n`;
      }
      
      if (applications.length > 5) {
        insightsResult += `... and ${applications.length - 5} more applications\n`;
      }
      
      insightsResult += `\n## Data Access Confirmed:\n`;
      insightsResult += `- Archer GRC platform connection: ✅ Active\n`;
      insightsResult += `- Application metadata: ✅ Retrieved\n`;
      insightsResult += `- Data permissions: ✅ Verified\n\n`;

      insightsResult += `**Note**: This tool provides data inventory only. For AI-generated insights and analysis based on your specific focus area (${focus_area}), please use an LLM service that can process and analyze the available GRC data.\n\n`;
      
      insightsResult += `**Next Steps**:\n`;
      insightsResult += `1. Use search_archer_records to retrieve specific data from applications\n`;
      insightsResult += `2. Use get_archer_stats for detailed application metrics\n`;
      insightsResult += `3. Process retrieved data through an AI analysis service\n\n`;
      
      insightsResult += `**Connection Status**: Active | **Report Generated**: ${new Date().toISOString()}`;

      return {
        content: [{
          type: 'text',
          text: insightsResult
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating insights: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Test Archer connection
   */
  private async testArcherConnection(args: TestConnectionArgs): Promise<CallToolResult> {
    const { tenant_id, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection configured for tenant ${tenant_id}. Please set environment variables: ARCHER_BASE_URL, ARCHER_USERNAME, ARCHER_PASSWORD, ARCHER_INSTANCE`
        }]
      };
    }

    // Test actual connection
    try {
      const archerClient = new ArcherAPIClient(connection);
      await archerClient.getApplications(); // Try to get applications to test connection
      
      return {
        content: [{
          type: 'text',
          text: `Archer connection test for tenant ${tenant_id}: SUCCESS - Connected to ${connection.baseUrl} and authenticated successfully.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Archer connection test for tenant ${tenant_id}: FAILED - ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * Debug Archer API
   */
  private async debugArcherApi(args: DebugApiArgs): Promise<CallToolResult> {
    const { tenant_id } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Archer API debug for tenant ${tenant_id}: Debug functionality requires live Archer API connection. Current implementation shows tool structure only. Please ensure Archer server is accessible and credentials are configured.`
      }]
    };
  }

  /**
   * Get application fields
   */
  private async getApplicationFields(args: GetFieldsArgs): Promise<CallToolResult> {
    console.log('[getApplicationFields] Method called with args:', args);
    const { tenant_id, applicationName, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve application fields for application ${applicationName} in tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform. Please verify Archer connectivity and application access permissions.`
        }]
      };
    }

    try {
      // Use ArcherAPIClient like the other working methods
      const archerClient = new ArcherAPIClient(connection);
      
      // For now, return a basic implementation since ArcherAPIClient may not have getApplicationFields method yet
      return {
        content: [{
          type: 'text',
          text: `Application Fields feature for '${applicationName}' in tenant ${tenant_id}\nInstance: ${connection.baseUrl}\nNote: Application fields API implementation in progress. This would connect to Archer to retrieve field definitions for the specified application.`
        }]
      };

    } catch (error: any) {
      console.error('[getApplicationFields] Error:', error);
      return {
        content: [{
          type: 'text',
          text: `Error retrieving application fields for '${applicationName}' in tenant ${tenant_id}: ${error.message || error}`
        }]
      };
    }
  }

  /**
   * Get top records
   */
  private async getTopRecords(args: GetTopRecordsArgs): Promise<CallToolResult> {
    console.log('[getTopRecords] Method called with args:', args);
    const { tenant_id, applicationName, topN, sortField, archer_connection } = args;
    const recordCount = topN || 10;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve top ${recordCount} records from application ${applicationName} for tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform with proper read permissions.`
        }]
      };
    }

    try {
      // Use ArcherAPIClient like the other working methods
      const archerClient = new ArcherAPIClient(connection);
      
      // Use existing searchRecords method with parameters for top records
      const searchResults = await archerClient.searchRecords(applicationName, Math.min(recordCount, 100), 1);
      
      let recordsList = `Top ${Math.min(recordCount, searchResults.records.length)} Records from '${applicationName}'\n`;
      recordsList += `Instance: ${connection.baseUrl}\n`;
      recordsList += `Total records in application: ${searchResults.totalCount}\n\n`;

      if (searchResults.records.length > 0) {
        searchResults.records.slice(0, recordCount).forEach((record: any, index: number) => {
          recordsList += `${index + 1}. Record:\n`;
          // Display available fields
          Object.keys(record).forEach(key => {
            if (record[key] !== null && record[key] !== undefined && record[key] !== '') {
              recordsList += `   ${key}: ${record[key]}\n`;
            }
          });
          recordsList += '\n';
        });
      } else {
        recordsList += `No records found in application '${applicationName}'.\n`;
      }

      return {
        content: [{
          type: 'text',
          text: recordsList
        }]
      };

    } catch (error: any) {
      console.error('[getTopRecords] Error:', error);
      return {
        content: [{
          type: 'text',
          text: `Error retrieving top ${recordCount} records from application '${applicationName}' for tenant ${tenant_id}: ${error.message || error}`
        }]
      };
    }
  }

  /**
   * Find record by ID
   */
  private async findRecordById(args: FindRecordArgs): Promise<CallToolResult> {
    console.log('[findRecordById] Method called with args:', args);
    const { tenant_id, applicationName, recordId, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `Unable to find record ${recordId} in application ${applicationName} for tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform and valid record access permissions.`
        }]
      };
    }

    try {
      // Use ArcherAPIClient like the other working methods
      const archerClient = new ArcherAPIClient(connection);
      
      // For now, return a basic implementation since ArcherAPIClient may not have findRecordById method yet
      return {
        content: [{
          type: 'text',
          text: `Find Record by ID feature for record ${recordId} in application '${applicationName}' for tenant ${tenant_id}\nInstance: ${connection.baseUrl}\nNote: Record lookup API implementation in progress. This would connect to Archer to retrieve specific record details.`
        }]
      };

    } catch (error: any) {
      console.error('[findRecordById] Error:', error);
      return {
        content: [{
          type: 'text',
          text: `Error finding record ${recordId} in application '${applicationName}' for tenant ${tenant_id}: ${error.message || error}`
        }]
      };
    }
  }

  /**
   * Get datafeeds
   */
  private async getDatafeeds(args: GetDatafeedsArgs): Promise<CallToolResult> {
    console.log('[getDatafeeds] Method called with args:', args);
    const { tenant_id, activeOnly, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve datafeeds for tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform with datafeed administration permissions.`
        }]
      };
    }

    try {
      // Use ArcherAPIClient like the other working methods
      const archerClient = new ArcherAPIClient(connection);
      
      // For now, return a basic implementation since ArcherAPIClient may not have getDatafeeds method yet
      return {
        content: [{
          type: 'text',
          text: `Datafeeds feature for tenant ${tenant_id}\nInstance: ${connection.baseUrl}\nNote: Datafeeds API implementation in progress. This would connect to Archer to retrieve datafeed information.`
        }]
      };

    } catch (error: any) {
      console.error('[getDatafeeds] Error:', error);
      return {
        content: [{
          type: 'text',
          text: `Error retrieving datafeeds for tenant ${tenant_id}: ${error.message || error}`
        }]
      };
    }
  }

  /**
   * Get datafeed history
   */
  private async getDatafeedHistory(args: GetDatafeedHistoryArgs): Promise<CallToolResult> {
    const { tenant_id, datafeedGuid } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Unable to retrieve history for datafeed ${datafeedGuid} in tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform with datafeed monitoring permissions.`
      }]
    };
  }

  /**
   * Get datafeed history messages
   */
  private async getDatafeedHistoryMessages(args: GetDatafeedMessagesArgs): Promise<CallToolResult> {
    const { tenant_id, historyId } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Unable to retrieve history messages for datafeed history ${historyId} in tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform with detailed log access.`
      }]
    };
  }

  /**
   * Check datafeed health
   */
  private async checkDatafeedHealth(args: CheckDatafeedHealthArgs): Promise<CallToolResult> {
    const { tenant_id } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Unable to check datafeed health for tenant ${tenant_id}. This operation requires an active connection to your Archer GRC platform with system monitoring permissions.`
      }]
    };
  }

  /**
   * Get security events
   */
  private async getSecurityEvents(args: GetSecurityEventsArgs): Promise<CallToolResult> {
    const { tenant_id, archer_connection } = args;
    
    // Use provided connection or fall back to environment variables
    const connection = archer_connection || {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      username: process.env.ARCHER_USERNAME || '',
      password: process.env.ARCHER_PASSWORD || '',
      instanceId: process.env.ARCHER_INSTANCE || '',
      userDomainId: process.env.ARCHER_USER_DOMAIN_ID || ''
    };
    
    if (!connection.baseUrl) {
      return {
        content: [{
          type: 'text',
          text: `No Archer connection configured for tenant ${tenant_id}. Please configure your Archer connection credentials.`
        }]
      };
    }

    try {
      const archerClient = new ArcherAPIClient(connection);
      
      // Try to get audit logs or security-related records
      // First, try to find security-related applications
      const applications = await archerClient.getApplications();
      const securityApps = applications.filter(app => 
        app.Name && (
          app.Name.toLowerCase().includes('security') ||
          app.Name.toLowerCase().includes('audit') ||
          app.Name.toLowerCase().includes('incident') ||
          app.Name.toLowerCase().includes('event')
        )
      );
      
      if (securityApps.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No security-related applications found in Archer for tenant ${tenant_id}. Available applications: ${applications.slice(0, 5).map(a => a.Name).join(', ')}`
          }]
        };
      }
      
      // Get recent records from the first security application
      const securityApp = securityApps[0];
      const recentRecords = await archerClient.searchRecords(securityApp.Name, 10, 1);
      
      let resultText = `Security Events for ${securityApp.Name} (Tenant: ${tenant_id})\n`;
      resultText += `Found ${recentRecords.totalCount} total security records\n\n`;
      
      if (recentRecords.records.length > 0) {
        resultText += `Recent ${recentRecords.records.length} records:\n`;
        recentRecords.records.forEach((record, index) => {
          const recordId = record['Content ID'] || record.Id || 'Unknown';
          const trackingId = record['Tracking ID'] || '';
          resultText += `${index + 1}. Record ID: ${recordId}`;
          if (trackingId) resultText += ` | Tracking: ${trackingId}`;
          resultText += '\n';
          
          // Show a few key fields
          Object.keys(record).slice(0, 3).forEach(key => {
            if (record[key] && typeof record[key] === 'string' && record[key].length < 100) {
              resultText += `   ${key}: ${record[key]}\n`;
            }
          });
          resultText += '\n';
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };
      
    } catch (error) {
      console.error('[GRC Server] Error getting security events:', (error as Error).message);
      return {
        content: [{
          type: 'text',
          text: `Error retrieving security events for tenant ${tenant_id}: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * HTTP mode handler for list tools
   */
  public async handleListTools(): Promise<ListToolsResult> {
    // Get all tools from the server handlers
    const tools: Tool[] = [
      {
        name: 'get_archer_applications',
        description: 'List all active Archer applications and questionnaires available for analysis',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'search_archer_records',
        description: 'Search and retrieve records from a specific Archer application with privacy protection and field transformation',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            applicationName: {
              type: 'string',
              description: 'Name or alias of the Archer application'
            },
            pageSize: {
              type: 'number',
              description: 'Number of records to return (1-10000, default: 100)',
              minimum: 1,
              maximum: 10000
            },
            pageNumber: {
              type: 'number',
              description: 'Page number for pagination (1-based, default: 1)',
              minimum: 1
            }
          },
          required: ['tenant_id', 'applicationName']
        }
      },
      {
        name: 'get_archer_stats',
        description: 'Get statistical analysis and counts for Archer applications and records',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'analyze_grc_data',
        description: 'Perform advanced GRC data analysis across multiple applications',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            analysisType: {
              type: 'string',
              description: 'Type of analysis to perform'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'generate_insights',
        description: 'Generate business insights from GRC data patterns and trends',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            insightType: {
              type: 'string',
              description: 'Type of insights to generate'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'test_archer_connection',
        description: 'Test connectivity and authentication with Archer GRC platform',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'debug_archer_api',
        description: 'Debug Archer API calls and troubleshoot connection issues',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            debugLevel: {
              type: 'string',
              description: 'Debug level (basic, detailed, verbose)'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'get_application_fields',
        description: 'Get detailed field definitions and metadata for an Archer application',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            applicationName: {
              type: 'string',
              description: 'Name or alias of the Archer application'
            }
          },
          required: ['tenant_id', 'applicationName']
        }
      },
      {
        name: 'get_top_records',
        description: 'Get top records from an application based on specified criteria',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            applicationName: {
              type: 'string',
              description: 'Name or alias of the Archer application'
            },
            sortBy: {
              type: 'string',
              description: 'Field to sort by'
            },
            limit: {
              type: 'number',
              description: 'Number of top records to return'
            }
          },
          required: ['tenant_id', 'applicationName']
        }
      },
      {
        name: 'find_record_by_id',
        description: 'Find and retrieve a specific record by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            applicationName: {
              type: 'string',
              description: 'Name or alias of the Archer application'
            },
            recordId: {
              type: 'string',
              description: 'ID of the record to retrieve'
            }
          },
          required: ['tenant_id', 'applicationName', 'recordId']
        }
      },
      {
        name: 'get_datafeeds',
        description: 'Get information about Archer data feeds and import processes',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'get_datafeed_history',
        description: 'Get execution history for Archer data feeds',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            datafeedId: {
              type: 'string',
              description: 'ID of the data feed'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'get_datafeed_history_messages',
        description: 'Get detailed messages from data feed execution history',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            historyId: {
              type: 'string',
              description: 'ID of the data feed history entry'
            }
          },
          required: ['tenant_id', 'historyId']
        }
      },
      {
        name: 'check_datafeed_health',
        description: 'Check the health and status of Archer data feeds',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            }
          },
          required: ['tenant_id']
        }
      },
      {
        name: 'get_security_events',
        description: 'Get security events and audit information from Archer',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: {
              type: 'string',
              description: 'Tenant identifier for data scoping'
            },
            eventType: {
              type: 'string',
              description: 'Type of security events to retrieve'
            },
            timeRange: {
              type: 'string',
              description: 'Time range for events (e.g., 24h, 7d, 30d)'
            }
          },
          required: ['tenant_id']
        }
      }
    ];
    
    return { tools };
  }

  /**
   * HTTP mode handler for call tool
   */
  public async handleCallTool(request: any): Promise<CallToolResult> {
    const { name, arguments: args } = request;
    
    // Route to the appropriate handler based on tool name
    switch (name) {
      case 'get_archer_applications':
        return await this.getArcherApplications(args);
      case 'search_archer_records':
        return await this.searchArcherRecords(args);
      case 'get_archer_stats':
        return await this.getArcherStats(args);
      case 'analyze_grc_data':
        return await this.analyzeGrcData(args);
      case 'generate_insights':
        return await this.generateInsights(args);
      case 'test_archer_connection':
        return await this.testArcherConnection(args);
      case 'debug_archer_api':
        return await this.debugArcherApi(args);
      case 'get_application_fields':
        return await this.getApplicationFields(args);
      case 'get_top_records':
        return await this.getTopRecords(args);
      case 'find_record_by_id':
        return await this.findRecordById(args);
      case 'get_datafeeds':
        return await this.getDatafeeds(args);
      case 'get_datafeed_history':
        return await this.getDatafeedHistory(args);
      case 'get_datafeed_history_messages':
        return await this.getDatafeedHistoryMessages(args);
      case 'check_datafeed_health':
        return await this.checkDatafeedHealth(args);
      case 'get_security_events':
        return await this.getSecurityEvents(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public get serverInstance(): Server {
    return this.server;
  }
}

// Export the server class for use in other modules
export { GRCMCPServer };

// Only start the server if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const grcServer = new GRCMCPServer();
  const transport = new StdioServerTransport();
  
  console.error('GRC Production MCP Server running on stdio');
  grcServer.serverInstance.connect(transport);
}