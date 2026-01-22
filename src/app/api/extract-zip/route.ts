import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { CONFIG, isValidFileSize } from '@/lib/config';
import { logger } from '@/lib/logger';
import { generateRequestId, errorResponse, handleApiError, ErrorCodes } from '@/lib/apiUtils';

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
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const includeSubfolders = formData.get('includeSubfolders') === 'true';

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

      // Get file extension
      const fileExt = relativePath.toLowerCase().split('.').pop();
      if (!fileExt || !CONFIG.SUPPORTED_EXTENSIONS.includes(fileExt as any)) return;

      // Check if we should include subfolders
      const pathParts = relativePath.split('/');
      if (!includeSubfolders && pathParts.length > 1) {
        // File is in a subfolder, skip it
        return;
      }

      // Get just the filename
      const fileName = pathParts[pathParts.length - 1];

      // Skip hidden files
      if (fileName.startsWith('.')) return;

      const promise = zipEntry.async('base64').then((data) => {
        // Calculate size from base64 data (base64 is ~4/3 of original size)
        const estimatedSize = Math.floor(data.length * 0.75);
        extractedFiles.push({
          name: fileName,
          path: relativePath,
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

    logger.info('ZIP extraction complete', { 
      requestId, 
      totalFiles: extractedFiles.length 
    });

    return NextResponse.json({
      success: true,
      totalFiles: extractedFiles.length,
      files: extractedFiles,
      requestId,
    });

  } catch (error) {
    return handleApiError(error, requestId);
  }
}

