import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedFile {
  name: string;
  path: string;
  size: number;
  data: string; // base64 encoded
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const includeSubfolders = formData.get('includeSubfolders') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'zip') {
      return NextResponse.json(
        { error: 'File must be a ZIP archive' },
        { status: 400 }
      );
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const extractedFiles: ExtractedFile[] = [];
    const validExtensions = ['pdf', 'docx'];

    // Process each file in the ZIP
    const promises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      // Skip directories
      if (zipEntry.dir) return;

      // Get file extension
      const fileExt = relativePath.toLowerCase().split('.').pop();
      if (!fileExt || !validExtensions.includes(fileExt)) return;

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
        extractedFiles.push({
          name: fileName,
          path: relativePath,
          size: zipEntry._data?.uncompressedSize || 0,
          data,
        });
      });

      promises.push(promise);
    });

    await Promise.all(promises);

    if (extractedFiles.length === 0) {
      return NextResponse.json(
        { 
          error: 'No PDF or Word documents found in the ZIP archive',
          hint: includeSubfolders 
            ? 'The archive contains no supported files.' 
            : 'Try enabling "Include Subfolders" if files are in nested directories.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      totalFiles: extractedFiles.length,
      files: extractedFiles,
    });

  } catch (error) {
    console.error('Error extracting ZIP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract ZIP file' },
      { status: 500 }
    );
  }
}

