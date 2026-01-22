import { extractText } from 'unpdf';
import { logger } from './logger';
import { CONFIG } from './config';

export interface ParseResult {
  success: boolean;
  text: string;
  error?: string;
  pageCount?: number;
}

/**
 * Extract text from a PDF file buffer using unpdf (server-friendly)
 * Includes retry logic and detailed error handling
 */
export async function parsePDF(buffer: Buffer, retries = CONFIG.MAX_RETRIES): Promise<ParseResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Validate buffer
      if (!buffer || buffer.length === 0) {
        return {
          success: false,
          text: '',
          error: 'Empty or invalid PDF buffer provided',
        };
      }

      // Check PDF magic bytes (PDF files start with %PDF)
      const header = buffer.slice(0, 5).toString('ascii');
      if (!header.startsWith('%PDF')) {
        return {
          success: false,
          text: '',
          error: 'File does not appear to be a valid PDF (missing PDF header)',
        };
      }

      const { text, totalPages } = await extractText(buffer, {
        mergePages: true, // Merge all pages into single text
      });
      
      return {
        success: true,
        text: text || '',
        pageCount: totalPages,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.debug(`PDF parsing attempt ${attempt + 1} failed`, { error: lastError.message });
      
      // Don't retry for certain errors
      if (lastError.message.includes('Invalid PDF') || 
          lastError.message.includes('password') ||
          lastError.message.includes('encrypted')) {
        break;
      }
      
      // Wait briefly before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // Provide helpful error messages
  let errorMessage = lastError?.message || 'Failed to parse PDF';
  
  if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
    errorMessage = 'PDF is password-protected or encrypted. Please provide an unprotected PDF.';
  } else if (errorMessage.includes('Invalid PDF')) {
    errorMessage = 'The file appears to be corrupted or is not a valid PDF.';
  }

  return {
    success: false,
    text: '',
    error: errorMessage,
  };
}

/**
 * Extract text from a Word document buffer (.docx)
 * Includes validation and detailed error handling
 */
export async function parseWord(buffer: Buffer): Promise<ParseResult> {
  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        text: '',
        error: 'Empty or invalid Word document buffer provided',
      };
    }

    // Check DOCX magic bytes (ZIP format starts with PK)
    const header = buffer.slice(0, 2).toString('ascii');
    if (header !== 'PK') {
      return {
        success: false,
        text: '',
        error: 'File does not appear to be a valid Word document (.docx). Note: .doc files are not supported, only .docx.',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      success: true,
      text: result.value || '',
    };
  } catch (error) {
    logger.error('Word parsing error', error);
    
    let errorMessage = error instanceof Error ? error.message : 'Failed to parse Word document';
    
    // Provide helpful error messages
    if (errorMessage.includes('Could not find') || errorMessage.includes('corrupted')) {
      errorMessage = 'The Word document appears to be corrupted or invalid.';
    }
    
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Parse a document based on its file type
 */
export async function parseDocument(buffer: Buffer, filename: string): Promise<ParseResult> {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseWord(buffer);
    case 'doc':
      return {
        success: false,
        text: '',
        error: 'Legacy .doc files are not supported. Please convert to .docx format.',
      };
    default:
      return {
        success: false,
        text: '',
        error: `Unsupported file type: .${extension}. Supported formats: PDF (.pdf), Word (.docx)`,
      };
  }
}
