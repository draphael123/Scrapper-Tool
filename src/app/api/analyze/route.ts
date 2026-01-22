import { NextRequest } from 'next/server';
import { parseDocument } from '@/lib/documentParser';
import { analyzeDocument, exportToCSV, ExtractionResult } from '@/lib/fileNameExtractor';
import { analyzeWithAI, isAIAvailable, AIAnalysisResult } from '@/lib/aiAnalyzer';
import { CONFIG, isValidFileType, isValidFileSize } from '@/lib/config';
import { logger } from '@/lib/logger';
import { generateRequestId, errorResponse, handleApiError, ErrorCodes } from '@/lib/apiUtils';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // CONFIG.DEFAULT_TIMEOUT

// Convert AI result to standard format for consistent UI handling
function convertAIResultToStandard(aiResult: AIAnalysisResult): ExtractionResult & { aiEnhanced: true; summary: string; documentType: string } {
  return {
    totalFound: aiResult.totalFound,
    patterns: aiResult.patterns.map(p => ({
      pattern: p.pattern,
      files: p.files.map(f => ({
        name: f.name,
        extension: f.extension,
        confidence: f.confidence
      })),
      count: p.count,
      description: p.description
    })),
    duplicates: aiResult.duplicates,
    aiEnhanced: true,
    summary: aiResult.summary,
    documentType: aiResult.documentType
  };
}

export async function GET() {
  const requestId = generateRequestId();
  logger.info('AI availability check', { requestId });
  
  return NextResponse.json({
    aiAvailable: isAIAvailable(),
    requestId,
  });
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const exportCSVFlag = formData.get('exportCSV') === 'true';
    const useAI = formData.get('useAI') === 'true';

    logger.info('Document analysis request', { 
      requestId, 
      fileName: file?.name, 
      fileSize: file?.size,
      useAI 
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
    if (!isValidFileSize(file.size)) {
      return errorResponse(
        `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed limit of ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB`,
        ErrorCodes.FILE_TOO_LARGE,
        413,
        { fileSize: file.size, maxSize: CONFIG.MAX_FILE_SIZE },
        requestId
      );
    }

    // Validate file type
    if (!isValidFileType(file)) {
      return errorResponse(
        'Invalid file type. Please upload a PDF or Word document (.docx).',
        ErrorCodes.INVALID_FILE_TYPE,
        400,
        { fileName: file.name, fileType: file.type },
        requestId
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file type
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'docx';

    // Parse the document
    const parseResult = await parseDocument(buffer, file.name);

    if (!parseResult.success) {
      return errorResponse(
        parseResult.error || 'Failed to parse document',
        ErrorCodes.PARSE_ERROR,
        400,
        { fileName: file.name },
        requestId
      );
    }

    if (!parseResult.text || parseResult.text.trim().length === 0) {
      return errorResponse(
        'The document appears to be empty or contains no extractable text.',
        ErrorCodes.PARSE_ERROR,
        400,
        { fileName: file.name },
        requestId
      );
    }

    let analysisResult: ExtractionResult & { aiEnhanced?: boolean; summary?: string; documentType?: string };

    // Use AI analysis if requested and available
    if (useAI && isAIAvailable()) {
      try {
        const aiResult = await analyzeWithAI(parseResult.text, fileType);
        if (aiResult) {
          analysisResult = convertAIResultToStandard(aiResult);
        } else {
          // Fallback to regex if AI fails
          analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
        }
      } catch (aiError) {
        logger.warn('AI analysis failed, falling back to regex', { error: aiError, requestId });
        analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
      }
    } else {
      // Use regex-based analysis
      analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
    }

    // Return CSV if requested
    if (exportCSVFlag) {
      const csvContent = exportToCSV(analysisResult);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="file-analysis-${Date.now()}.csv"`,
        },
      });
    }

    // Return analysis results
    logger.info('Document analysis complete', { 
      requestId, 
      fileName: file.name,
      totalFound: analysisResult.totalFound 
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType,
      pageCount: parseResult.pageCount,
      textLength: parseResult.text.length,
      analysis: analysisResult,
      aiAvailable: isAIAvailable(),
      aiUsed: useAI && isAIAvailable(),
      requestId,
    });

  } catch (error) {
    return handleApiError(error, requestId);
  }
}
