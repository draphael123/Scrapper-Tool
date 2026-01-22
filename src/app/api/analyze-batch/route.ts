import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/documentParser';
import { analyzeDocument, ExtractionResult } from '@/lib/fileNameExtractor';
import { analyzeWithAI, isAIAvailable, AIAnalysisResult } from '@/lib/aiAnalyzer';
import { CONFIG, isValidFileType, isValidFileSize } from '@/lib/config';
import { logger } from '@/lib/logger';
import { generateRequestId, errorResponse, handleApiError, ErrorCodes } from '@/lib/apiUtils';

export const runtime = 'nodejs';
export const maxDuration = 120; // CONFIG.BATCH_TIMEOUT

interface FileResult {
  fileName: string;
  fileType: string;
  success: boolean;
  error?: string;
  analysis?: ExtractionResult & { aiEnhanced?: boolean };
  textLength?: number;
  pageCount?: number;
}

interface BatchResult {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: FileResult[];
  combinedAnalysis: ExtractionResult & { 
    aiEnhanced?: boolean;
    sourceFiles: string[];
  };
}

// Merge multiple analysis results into one
function mergeAnalysisResults(
  results: Array<{ fileName: string; analysis: ExtractionResult & { aiEnhanced?: boolean } }>
): ExtractionResult & { aiEnhanced?: boolean; sourceFiles: string[] } {
  const allPatterns: Map<string, { files: ExtractionResult['patterns'][0]['files']; description?: string }> = new Map();
  const allDuplicates: Set<string> = new Set();
  const sourceFiles: string[] = [];
  let aiEnhanced = false;

  for (const { fileName, analysis } of results) {
    sourceFiles.push(fileName);
    
    if (analysis.aiEnhanced) {
      aiEnhanced = true;
    }

    // Merge duplicates
    for (const dup of analysis.duplicates) {
      allDuplicates.add(dup);
    }

    // Merge patterns
    for (const pattern of analysis.patterns) {
      const existing = allPatterns.get(pattern.pattern);
      if (existing) {
        // Merge files into existing pattern
        existing.files.push(...pattern.files);
      } else {
        allPatterns.set(pattern.pattern, {
          files: [...pattern.files],
          description: pattern.description,
        });
      }
    }
  }

  // Convert back to array format
  const patterns = Array.from(allPatterns.entries())
    .map(([pattern, data]) => ({
      pattern,
      files: data.files,
      count: data.files.length,
      description: data.description,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate total
  const totalFound = patterns.reduce((sum, p) => sum + p.count, 0);

  return {
    totalFound,
    patterns,
    duplicates: Array.from(allDuplicates),
    aiEnhanced,
    sourceFiles,
  };
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const useAI = formData.get('useAI') === 'true';

    logger.info('Batch analysis request', { 
      requestId, 
      fileCount: files.length,
      useAI 
    });

    if (!files || files.length === 0) {
      return errorResponse(
        'No files provided',
        ErrorCodes.VALIDATION_ERROR,
        400,
        undefined,
        requestId
      );
    }

    if (files.length > CONFIG.MAX_BATCH_FILES) {
      return errorResponse(
        `Too many files. Maximum allowed is ${CONFIG.MAX_BATCH_FILES} files per batch.`,
        ErrorCodes.VALIDATION_ERROR,
        400,
        { fileCount: files.length, maxFiles: CONFIG.MAX_BATCH_FILES },
        requestId
      );
    }

    // Validate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (!isValidFileSize(totalSize, CONFIG.MAX_BATCH_SIZE)) {
      return errorResponse(
        `Total file size (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed limit of ${CONFIG.MAX_BATCH_SIZE / 1024 / 1024} MB`,
        ErrorCodes.FILE_TOO_LARGE,
        413,
        { totalSize, maxSize: CONFIG.MAX_BATCH_SIZE },
        requestId
      );
    }

    const results: FileResult[] = [];
    const successfulAnalyses: Array<{ fileName: string; analysis: ExtractionResult & { aiEnhanced?: boolean } }> = [];

    // Process each file
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop();
      
      // Skip non-supported files
      if (!ext || !CONFIG.SUPPORTED_EXTENSIONS.includes(ext as any)) {
        results.push({
          fileName: file.name,
          fileType: ext || 'unknown',
          success: false,
          error: `Unsupported file type. Only PDF and DOCX are supported.`,
        });
        continue;
      }

      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse the document
        const parseResult = await parseDocument(buffer, file.name);

        if (!parseResult.success) {
          results.push({
            fileName: file.name,
            fileType: ext,
            success: false,
            error: parseResult.error || 'Failed to parse document',
          });
          continue;
        }

        if (!parseResult.text || parseResult.text.trim().length === 0) {
          results.push({
            fileName: file.name,
            fileType: ext,
            success: false,
            error: 'Document is empty or contains no extractable text.',
          });
          continue;
        }

        // Analyze the document
        let analysis: ExtractionResult & { aiEnhanced?: boolean };

        if (useAI && isAIAvailable()) {
          try {
            const aiResult = await analyzeWithAI(parseResult.text, ext);
            if (aiResult) {
              analysis = {
                totalFound: aiResult.totalFound,
                patterns: aiResult.patterns.map(p => ({
                  pattern: p.pattern,
                  files: p.files.map(f => ({
                    name: f.name,
                    extension: f.extension,
                    confidence: f.confidence,
                  })),
                  count: p.count,
                  description: p.description,
                })),
                duplicates: aiResult.duplicates,
                aiEnhanced: true,
              };
            } else {
              analysis = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
            }
          } catch (aiError) {
            logger.warn('AI analysis failed for batch file, falling back to regex', { 
              error: aiError, 
              fileName: file.name,
              requestId 
            });
            analysis = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
          }
        } else {
          analysis = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
        }

        results.push({
          fileName: file.name,
          fileType: ext,
          success: true,
          analysis,
          textLength: parseResult.text.length,
          pageCount: parseResult.pageCount,
        });

        successfulAnalyses.push({ fileName: file.name, analysis });

      } catch (error) {
        results.push({
          fileName: file.name,
          fileType: ext,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate stats
    const successfulFiles = results.filter(r => r.success).length;
    const failedFiles = results.filter(r => !r.success).length;

    // Merge all successful analyses
    const combinedAnalysis = successfulAnalyses.length > 0
      ? mergeAnalysisResults(successfulAnalyses)
      : {
          totalFound: 0,
          patterns: [],
          duplicates: [],
          aiEnhanced: false,
          sourceFiles: [],
        };

    const batchResult: BatchResult = {
      totalFiles: files.length,
      successfulFiles,
      failedFiles,
      results,
      combinedAnalysis,
    };

    logger.info('Batch analysis complete', { 
      requestId, 
      totalFiles: batchResult.totalFiles,
      successfulFiles: batchResult.successfulFiles,
      failedFiles: batchResult.failedFiles
    });

    return NextResponse.json({
      success: true,
      aiAvailable: isAIAvailable(),
      aiUsed: useAI && isAIAvailable(),
      ...batchResult,
      requestId,
    });

  } catch (error) {
    return handleApiError(error, requestId);
  }
}

