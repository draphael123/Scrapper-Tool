import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/documentParser';
import { analyzeDocument, exportToCSV, ExtractionResult } from '@/lib/fileNameExtractor';
import { analyzeWithAI, isAIAvailable, AIAnalysisResult } from '@/lib/aiAnalyzer';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow longer for AI analysis

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
  // Check if AI is available
  return NextResponse.json({
    aiAvailable: isAIAvailable()
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const exportCSVFlag = formData.get('exportCSV') === 'true';
    const useAI = formData.get('useAI') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    const isValidType = validTypes.includes(file.type) || 
      file.name.endsWith('.pdf') || 
      file.name.endsWith('.docx');

    if (!isValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF or Word document (.docx).' },
        { status: 400 }
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
      return NextResponse.json(
        { error: parseResult.error || 'Failed to parse document' },
        { status: 400 }
      );
    }

    if (!parseResult.text || parseResult.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'The document appears to be empty or contains no extractable text.' },
        { status: 400 }
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
        console.error('AI analysis failed, falling back to regex:', aiError);
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
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType,
      pageCount: parseResult.pageCount,
      textLength: parseResult.text.length,
      analysis: analysisResult,
      aiAvailable: isAIAvailable(),
      aiUsed: useAI && isAIAvailable()
    });

  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
