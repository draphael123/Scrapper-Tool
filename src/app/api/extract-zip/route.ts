import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { CONFIG, isValidFileSize } from '@/lib/config';
import { logger } from '@/lib/logger';
import { generateRequestId, errorResponse, handleApiError, ErrorCodes } from '@/lib/apiUtils';
import { RATE_LIMITS, checkRateLimit, getClientId } from '@/lib/rateLimit';
import { sanitizeFilePath, sanitizeFileName } from '@/lib/sanitize';
import { validateFile, validateBoolean } from '@/lib/validation';
import { metrics } from '@/lib/metrics';

export const runtime = 'nodejs';
export const maxDuration = 60; // CONFIG.ZIP_TIMEOUT

interface ExtractedFile {
  name: string;
  path: string;
  size: number;
  data: string; // base64 encoded
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientId = getClientId(request);
  
  try {
    // Rate limiting
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.UPLOAD);
    if (!rateLimitResult.allowed) {
      metrics.increment('rate_limit_exceeded', { endpoint: 'extract-zip' });
      return errorResponse(
        'Too many requests. Please try again later.',
        ErrorCodes.RATE_LIMIT_ERROR,
        429,
        { resetTime: new Date(rateLimitResult.resetTime).toISOString() },
        requestId
      );
    }

    const formData = await request.formData();
    const fileInput = formData.get('file') as File | null;
    const includeSubfolders = validateBoolean(formData.get('includeSubfolders'));

    // Validate file
    const fileValidation = validateFile(fileInput);
    if (!fileValidation.success) {
      metrics.increment('validation_error', { endpoint: 'extract-zip' });
      return errorResponse(
        fileValidation.error || 'Invalid file',
        ErrorCodes.VALIDATION_ERROR,
        400,
        undefined,
        requestId
      );
    }
    const file = fileValidation.data!;

    logger.info('ZIP extraction request', { 
      requestId, 
      fileName: file?.name,
      fileSize: file?.size,
      includeSubfolders 
    });

    if (!file) {
      return errorResponse(
        'No file provided',
        ErrorCodes.VALIDATION_ERROR,
        400,
        undefined,
        requestId
      );
    }

    // Validate file size
    if (!isValidFileSize(file.size, CONFIG.MAX_ZIP_SIZE)) {
      return errorResponse(
        `ZIP file size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed limit of ${CONFIG.MAX_ZIP_SIZE / 1024 / 1024} MB`,
        ErrorCodes.FILE_TOO_LARGE,
        413,
        { fileSize: file.size, maxSize: CONFIG.MAX_ZIP_SIZE },
        requestId
      );
    }

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'zip') {
      return errorResponse(
        'File must be a ZIP archive',
        ErrorCodes.INVALID_FILE_TYPE,
        400,
        { fileName: file.name, fileType: ext },
        requestId
      );
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const extractedFiles: ExtractedFile[] = [];

    // Process each file in the ZIP
    const promises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      // Skip directories
      if (zipEntry.dir) return;

      // Sanitize and validate file path
      const pathValidation = sanitizeFilePath(relativePath);
      if (!pathValidation.isValid) {
        logger.warn('Invalid file path in ZIP', { path: relativePath, requestId });
        return;
      }

      // Get file extension
      const fileExt = pathValidation.sanitized.toLowerCase().split('.').pop();
      if (!fileExt || !CONFIG.SUPPORTED_EXTENSIONS.includes(fileExt as any)) return;

      // Check if we should include subfolders
      const pathParts = pathValidation.sanitized.split('/');
      if (!includeSubfolders && pathParts.length > 1) {
        // File is in a subfolder, skip it
        return;
      }

      // Get just the filename and sanitize it
      const fileName = sanitizeFileName(pathParts[pathParts.length - 1]);

      // Skip hidden files
      if (fileName.startsWith('.')) return;

      const promise = zipEntry.async('base64').then((data) => {
        // Calculate size from base64 data (base64 is ~4/3 of original size)
        const estimatedSize = Math.floor(data.length * 0.75);
        extractedFiles.push({
          name: fileName,
          path: pathValidation.sanitized,
          size: estimatedSize,
          data,
        });
      });

      promises.push(promise);
    });

    await Promise.all(promises);

    if (extractedFiles.length === 0) {
      return errorResponse(
        'No PDF or Word documents found in the ZIP archive',
        ErrorCodes.VALIDATION_ERROR,
        400,
        { 
          hint: includeSubfolders 
            ? 'The archive contains no supported files.' 
            : 'Try enabling "Include Subfolders" if files are in nested directories.',
          includeSubfolders 
        },
        requestId
      );
    }

    const totalTime = Date.now() - startTime;
    metrics.timing('zip_extraction', totalTime);
    metrics.increment('zip_extraction_success', { fileCount: extractedFiles.length.toString() });
    
    logger.info('ZIP extraction complete', { 
      requestId, 
      totalFiles: extractedFiles.length,
      duration: totalTime
    });

    const response = NextResponse.json({
      success: true,
      totalFiles: extractedFiles.length,
      files: extractedFiles,
      requestId,
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMITS.UPLOAD.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    return response;

  } catch (error) {
    return handleApiError(error, requestId);
  }
}

