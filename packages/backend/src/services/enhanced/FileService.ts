import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';

export interface ProcessedFile {
  originalName: string;
  mimeType: string;
  size: number;
  content?: string;
  metadata: {
    extractedText?: string;
    imageInfo?: any;
    grcClassification?: {
      category: string;
      riskLevel: string;
      containsSensitiveData: boolean;
      complianceRelevant: boolean;
    };
  };
  processingTime: number;
}

export class FileService {
  private uploadDir: string;

  constructor(uploadDir: string = 'temp/') {
    this.uploadDir = uploadDir;
    this.ensureUploadDirectory();
    console.log('📁 Enhanced GRC File Service initialized');
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    const startTime = Date.now();
    console.log(`📄 Processing GRC file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

    const processedFile: ProcessedFile = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      metadata: {
        grcClassification: {
          category: 'unknown',
          riskLevel: 'low',
          containsSensitiveData: false,
          complianceRelevant: false
        }
      },
      processingTime: 0
    };

    try {
      // Process based on file type
      if (file.mimetype.startsWith('image/')) {
        await this.processImage(file, processedFile);
      } else if (file.mimetype === 'application/pdf') {
        await this.processPDF(file, processedFile);
      } else if (file.mimetype.startsWith('text/') || this.isTextFile(file.mimetype)) {
        await this.processTextFile(file, processedFile);
      } else {
        processedFile.metadata.extractedText = 'Binary file - content not extracted';
      }

      // Perform GRC-specific analysis
      await this.performGRCAnalysis(processedFile);

      processedFile.processingTime = Date.now() - startTime;
      console.log(`✅ File processed in ${processedFile.processingTime}ms`);

      // Clean up temp file
      await this.cleanupTempFile(file.path);

      return processedFile;

    } catch (error) {
      console.error('File processing error:', error);
      processedFile.metadata.extractedText = `Error processing file: ${error.message}`;
      processedFile.processingTime = Date.now() - startTime;
      return processedFile;
    }
  }

  private async processImage(file: Express.Multer.File, processedFile: ProcessedFile): Promise<void> {
    console.log('🖼️ Processing image file for GRC analysis');

    try {
      const metadata = await sharp(file.path).metadata();

      processedFile.metadata.imageInfo = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha
      };

      // For images, we might need OCR in the future
      processedFile.metadata.extractedText = 'Image file processed - OCR capabilities can be added for text extraction';

      // Check if image might contain sensitive information
      if (file.originalname.toLowerCase().includes('confidential') ||
          file.originalname.toLowerCase().includes('restricted')) {
        processedFile.metadata.grcClassification!.containsSensitiveData = true;
        processedFile.metadata.grcClassification!.riskLevel = 'medium';
      }

    } catch (error) {
      processedFile.metadata.extractedText = `Error processing image: ${error.message}`;
    }
  }

  private async processPDF(file: Express.Multer.File, processedFile: ProcessedFile): Promise<void> {
    console.log('📋 Processing PDF file for GRC content extraction');

    try {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);

      processedFile.metadata.extractedText = pdfData.text;
      processedFile.content = pdfData.text;

      console.log(`📊 Extracted ${pdfData.text.length} characters from PDF`);

      // PDF-specific metadata
      processedFile.metadata.pdfInfo = {
        pages: pdfData.numpages,
        info: pdfData.info,
        textLength: pdfData.text.length
      };

    } catch (error) {
      processedFile.metadata.extractedText = `Error processing PDF: ${error.message}`;
    }
  }

  private async processTextFile(file: Express.Multer.File, processedFile: ProcessedFile): Promise<void> {
    console.log('📝 Processing text file for GRC analysis');

    try {
      const content = await fs.readFile(file.path, 'utf-8');
      processedFile.content = content;
      processedFile.metadata.extractedText = content;

      console.log(`📊 Processed text file with ${content.length} characters`);

    } catch (error) {
      processedFile.metadata.extractedText = `Error processing text file: ${error.message}`;
    }
  }

  private async performGRCAnalysis(processedFile: ProcessedFile): Promise<void> {
    console.log('🔍 Performing GRC classification analysis');

    const text = processedFile.metadata.extractedText?.toLowerCase() || '';
    const filename = processedFile.originalName.toLowerCase();

    // Initialize classification
    const classification = processedFile.metadata.grcClassification!;

    // Analyze content for GRC categories
    const grcCategories = {
      policy: ['policy', 'procedure', 'standard', 'guideline', 'framework'],
      incident: ['incident', 'breach', 'violation', 'security event', 'compromise'],
      risk: ['risk assessment', 'threat', 'vulnerability', 'impact', 'likelihood'],
      compliance: ['audit', 'compliance', 'regulation', 'iso', 'gdpr', 'sox', 'hipaa'],
      control: ['control', 'safeguard', 'countermeasure', 'protection', 'mitigation']
    };

    let maxMatches = 0;
    let detectedCategory = 'general';

    for (const [category, keywords] of Object.entries(grcCategories)) {
      const matches = keywords.filter(keyword =>
        text.includes(keyword) || filename.includes(keyword)
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCategory = category;
      }
    }

    classification.category = detectedCategory;
    classification.complianceRelevant = maxMatches > 0;

    // Analyze for sensitive data indicators
    const sensitiveIndicators = [
      'confidential', 'restricted', 'private', 'classified',
      'social security', 'ssn', 'credit card', 'personal data',
      'financial information', 'medical record', 'pii'
    ];

    const hasSensitiveData = sensitiveIndicators.some(indicator =>
      text.includes(indicator) || filename.includes(indicator)
    );

    if (hasSensitiveData) {
      classification.containsSensitiveData = true;
      classification.riskLevel = 'high';
    }

    // Analyze risk level based on content
    const highRiskKeywords = ['critical', 'severe', 'major', 'breach', 'failure'];
    const mediumRiskKeywords = ['moderate', 'concern', 'issue', 'weakness'];

    if (highRiskKeywords.some(keyword => text.includes(keyword))) {
      classification.riskLevel = 'high';
    } else if (mediumRiskKeywords.some(keyword => text.includes(keyword))) {
      classification.riskLevel = 'medium';
    }

    console.log(`🏷️ GRC Classification: ${JSON.stringify(classification)}`);
  }

  private isTextFile(mimeType: string): boolean {
    const textMimeTypes = [
      'application/json',
      'application/xml',
      'application/csv',
      'text/csv',
      'text/plain',
      'text/html',
      'text/xml'
    ];

    return textMimeTypes.includes(mimeType);
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Cleaned up temp file: ${filePath}`);
    } catch (error) {
      console.warn(`Warning: Could not clean up temp file ${filePath}:`, error);
    }
  }

  async getFileAnalyticsSummary(): Promise<any> {
    // This would return analytics about processed files
    return {
      totalFilesProcessed: 'Not tracked in current session',
      averageProcessingTime: 'Not calculated',
      grcCategories: 'Will be tracked across sessions',
      sensitiveDataDetections: 'Will be tracked for compliance'
    };
  }

  // Future enhancements
  async performOCR(imagePath: string): Promise<string> {
    // TODO: Implement OCR for image text extraction
    console.log('🔮 Future: OCR text extraction from images');
    return 'OCR not implemented yet';
  }

  async scanForMalware(filePath: string): Promise<boolean> {
    // TODO: Implement malware scanning
    console.log('🛡️ Future: Malware scanning for uploaded files');
    return true; // Assume clean for now
  }

  async extractMetadata(filePath: string): Promise<any> {
    // TODO: Implement comprehensive metadata extraction
    console.log('📊 Future: Comprehensive metadata extraction');
    return {};
  }
}