import { NextRequest } from 'next/server';
import { parseDocument } from '@/lib/documentParser';
import { analyzeDocument, exportToCSV, ExtractionResult } from '@/lib/fileNameExtractor';
import { analyzeWithAI, isAIAvailable, AIAnalysisResult } from '@/lib/aiAnalyzer';
import { CONFIG, isValidFileType, isValidFileSize } from '@/lib/config';
import { logger } from '@/lib/logger';
import { generateRequestId, errorResponse, handleApiError, ErrorCodes } from '@/lib/apiUtils';
import { NextResponse } from 'next/server';
import { RATE_LIMITS, checkRateLimit, getClientId } from '@/lib/rateLimit';
import { sanitizeFileName, isFileNameSafe } from '@/lib/sanitize';
import { validateFile, validateBoolean } from '@/lib/validation';
import { cache } from '@/lib/cache';
import { metrics } from '@/lib/metrics';

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
  const startTime = Date.now();
  const clientId = getClientId(request);
  
  try {
    // Rate limiting
    const rateLimitConfig = request.headers.get('use-ai') === 'true' 
      ? RATE_LIMITS.AI 
      : RATE_LIMITS.UPLOAD;
    const rateLimitResult = checkRateLimit(clientId, rateLimitConfig);
    
    if (!rateLimitResult.allowed) {
      metrics.increment('rate_limit_exceeded', { endpoint: 'analyze' });
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
    const exportCSVFlag = validateBoolean(formData.get('exportCSV'));
    const useAI = validateBoolean(formData.get('useAI'));

    // Validate file
    const fileValidation = validateFile(fileInput);
    if (!fileValidation.success) {
      metrics.increment('validation_error', { endpoint: 'analyze', error: fileValidation.error || 'unknown' });
      return errorResponse(
        fileValidation.error || 'Invalid file',
        ErrorCodes.VALIDATION_ERROR,
        400,
        undefined,
        requestId
      );
    }
    const file = fileValidation.data!;

    // Sanitize file name
    const sanitizedName = sanitizeFileName(file.name);
    if (!isFileNameSafe(file.name)) {
      logger.warn('Unsafe file name detected', { original: file.name, sanitized: sanitizedName, requestId });
    }

    logger.info('Document analysis request', { 
      requestId, 
      fileName: sanitizedName, 
      fileSize: file.size,
      useAI 
    });

    metrics.increment('analysis_request', { useAI: useAI.toString() });

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

    // Check cache first
    const cacheKey = cache.generateKey(buffer, useAI ? 'ai' : 'regex');
    const cachedResult = cache.get<{ parseResult: any; analysisResult: any }>(cacheKey);
    
    let parseResult;
    let analysisResult: ExtractionResult & { aiEnhanced?: boolean; summary?: string; documentType?: string };
    
    if (cachedResult) {
      logger.debug('Using cached result', { requestId, cacheKey });
      parseResult = cachedResult.parseResult;
      analysisResult = cachedResult.analysisResult;
      metrics.increment('cache_hit', { endpoint: 'analyze' });
    } else {
      // Determine file type
      const fileType = sanitizedName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';

      // Parse the document
      const parseStartTime = Date.now();
      parseResult = await parseDocument(buffer, sanitizedName);
      metrics.timing('parse_document', Date.now() - parseStartTime, { fileType });

      if (!parseResult.success) {
        metrics.increment('parse_error', { fileType });
        return errorResponse(
          parseResult.error || 'Failed to parse document',
          ErrorCodes.PARSE_ERROR,
          400,
          { fileName: sanitizedName },
          requestId
        );
      }

      if (!parseResult.text || parseResult.text.trim().length === 0) {
        metrics.increment('empty_document_error');
        return errorResponse(
          'The document appears to be empty or contains no extractable text.',
          ErrorCodes.PARSE_ERROR,
          400,
          { fileName: sanitizedName },
          requestId
        );
      }

      // Use AI analysis if requested and available
      const analysisStartTime = Date.now();
      if (useAI && isAIAvailable()) {
        try {
          const aiResult = await analyzeWithAI(parseResult.text, fileType);
          if (aiResult) {
            analysisResult = convertAIResultToStandard(aiResult);
            metrics.timing('ai_analysis', Date.now() - analysisStartTime);
            metrics.increment('ai_analysis_success');
          } else {
            analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
            metrics.timing('regex_analysis', Date.now() - analysisStartTime);
            metrics.increment('ai_fallback_to_regex');
          }
        } catch (aiError) {
          logger.warn('AI analysis failed, falling back to regex', { error: aiError, requestId });
          analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
          metrics.increment('ai_analysis_error');
          metrics.timing('regex_analysis', Date.now() - analysisStartTime);
        }
      } else {
        analysisResult = { ...analyzeDocument(parseResult.text), aiEnhanced: false };
        metrics.timing('regex_analysis', Date.now() - analysisStartTime);
      }

      // Cache the result
      cache.set(cacheKey, { parseResult, analysisResult }, 60 * 60 * 1000); // 1 hour
      metrics.increment('cache_miss', { endpoint: 'analyze' });
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
    const totalTime = Date.now() - startTime;
    metrics.timing('analysis_total', totalTime, { useAI: useAI.toString() });
    metrics.increment('analysis_success', { useAI: useAI.toString() });
    
    logger.info('Document analysis complete', { 
      requestId, 
      fileName: sanitizedName,
      totalFound: analysisResult.totalFound,
      duration: totalTime
    });

    // Determine file type for response
    const fileType = sanitizedName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
    
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

    const response = NextResponse.json({
      success: true,
      fileName: sanitizedName,
      fileType,
      pageCount: parseResult.pageCount,
      textLength: parseResult.text.length,
      analysis: analysisResult,
      aiAvailable: isAIAvailable(),
      aiUsed: useAI && isAIAvailable(),
      requestId,
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    return response;

  } catch (error) {
    metrics.increment('analysis_error', { endpoint: 'analyze' });
    metrics.timing('analysis_total', Date.now() - startTime, { error: 'true' });
    return handleApiError(error, requestId);
  }
}
