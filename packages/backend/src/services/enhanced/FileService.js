import fs from 'fs/promises';

export class FileService {
  constructor() {
    console.log('📁 File service initialized');
  }

  async processFile(file) {
    console.log(`📄 Processing file: ${file.originalname}`);
    
    const fileInfo = {
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path
    };

    try {
      // Basic text extraction
      if (file.mimetype.startsWith('text/')) {
        fileInfo.content = await fs.readFile(file.path, 'utf-8');
      } else {
        fileInfo.content = `Binary file: ${file.mimetype}`;
      }

      return fileInfo;
    } catch (error) {
      console.error('Error processing file:', error);
      return fileInfo;
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error('Error cleaning up temp file:', error);
      }
    }
  }
}
