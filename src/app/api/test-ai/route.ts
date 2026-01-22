import { NextResponse } from 'next/server';
import { isAIAvailable, analyzeWithAI } from '@/lib/aiAnalyzer';

export const runtime = 'nodejs';

// Test document with file names
const TEST_DOCUMENT = `
File Inventory Report
Generated: 2024-01-15

The following files were found in the archive:

Tax Documents:
- 1099-2023-001.pdf
- 1099-2023-002.pdf
- W2_Employee_Smith_2023.pdf
- W2_Employee_Jones_2023.pdf

Reports:
- Monthly_Report_Jan.xlsx
- Monthly_Report_Feb.xlsx
- Monthly_Report_Mar.xlsx

Images:
- photo_001.jpg
- photo_002.jpg
`;

export async function GET() {
  const aiAvailable = isAIAvailable();
  
  if (!aiAvailable) {
    return NextResponse.json({
      status: 'error',
      message: 'OpenAI API key not configured',
      instructions: [
        '1. Open .env.local in your project root',
        '2. Add your API key: OPENAI_API_KEY=sk-your-key-here',
        '3. Restart the dev server',
        '4. Visit this endpoint again to test'
      ]
    }, { status: 400 });
  }

  try {
    // Test the AI with a sample document
    const result = await analyzeWithAI(TEST_DOCUMENT, 'txt');
    
    if (!result) {
      return NextResponse.json({
        status: 'error',
        message: 'AI returned no result'
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'AI is working correctly!',
      testResult: {
        documentType: result.documentType,
        summary: result.summary,
        totalFilesFound: result.totalFound,
        patternGroups: result.patterns.length,
        patterns: result.patterns.map(p => ({
          pattern: p.pattern,
          description: p.description,
          fileCount: p.count
        }))
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check if your API key is valid and has credits'
    }, { status: 500 });
  }
}

