import OpenAI from 'openai';
import { getOpenAIApiKey, CONFIG } from './config';
import { logger } from './logger';

export interface AIExtractedFile {
  name: string;
  extension: string;
  confidence: 'high' | 'medium' | 'low';
  context?: string;
}

export interface AIPatternGroup {
  pattern: string;
  description: string;
  files: AIExtractedFile[];
  count: number;
}

export interface AIAnalysisResult {
  totalFound: number;
  patterns: AIPatternGroup[];
  duplicates: string[];
  summary: string;
  documentType: string;
}

// System prompt for file extraction
const EXTRACTION_SYSTEM_PROMPT = `You are an expert document analyzer specializing in extracting file names and identifying naming patterns.

Your task is to:
1. Extract ALL file names from the provided document text
2. Group them by their naming convention/pattern
3. Identify the document type (e.g., "File Index", "Audit Report", "Inventory List")
4. Provide a brief summary of what was found

Rules for file name detection:
- Look for strings ending with file extensions (.pdf, .docx, .xlsx, .csv, .txt, .jpg, .png, etc.)
- Include files with various naming conventions (dates, numbers, prefixes, codes)
- Be thorough - extract ALL file names, even if they're in tables, lists, or paragraphs
- Note common prefixes like "1099", "W2", "INV-", "RPT-", form numbers, etc.

For pattern grouping:
- Group files that share the same naming structure
- Replace variable parts (numbers, dates, names) with descriptive placeholders
- Create a human-readable pattern description

Respond in valid JSON only, with this exact structure:
{
  "documentType": "string describing the document type",
  "summary": "brief summary of findings",
  "patterns": [
    {
      "pattern": "Pattern-XXX.pdf",
      "description": "Description of this pattern",
      "files": [
        {"name": "actual-filename.pdf", "extension": "pdf", "confidence": "high"}
      ]
    }
  ],
  "duplicates": ["list of duplicate file names if any"]
}`;

// Create OpenAI client (will use OPENAI_API_KEY env var)
function getOpenAIClient(): OpenAI | null {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Use AI to extract and analyze file names from document text
 */
export async function analyzeWithAI(
  text: string,
  fileType: string
): Promise<AIAnalysisResult | null> {
  const client = getOpenAIClient();
  
  if (!client) {
    logger.warn('OpenAI API key not configured');
    return null;
  }

  // Truncate very long documents to fit context window
  const truncatedText = text.length > CONFIG.AI_MAX_CHARS 
    ? text.substring(0, CONFIG.AI_MAX_CHARS) + '\n\n[Document truncated due to length...]'
    : text;

  try {
    const response = await client.chat.completions.create({
      model: CONFIG.AI_MODEL,
      messages: [
        {
          role: 'system',
          content: EXTRACTION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Analyze this ${fileType.toUpperCase()} document and extract all file names:\n\n${truncatedText}`
        }
      ],
      temperature: CONFIG.AI_TEMPERATURE,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

    const parsed = JSON.parse(content);
    
    // Transform to our format
    const patterns: AIPatternGroup[] = (parsed.patterns || []).map((p: {
      pattern: string;
      description: string;
      files: Array<{ name: string; extension: string; confidence: string }>;
    }) => ({
      pattern: p.pattern,
      description: p.description,
      files: p.files.map((f: { name: string; extension: string; confidence: string }) => ({
        name: f.name,
        extension: f.extension || f.name.split('.').pop()?.toLowerCase() || '',
        confidence: f.confidence as 'high' | 'medium' | 'low'
      })),
      count: p.files.length
    }));

    // Calculate total
    const totalFound = patterns.reduce((sum, p) => sum + p.count, 0);

    return {
      totalFound,
      patterns,
      duplicates: parsed.duplicates || [],
      summary: parsed.summary || 'Analysis complete',
      documentType: parsed.documentType || 'Unknown document type'
    };

  } catch (error) {
    logger.error('AI analysis error', error, { fileType });
    throw error;
  }
}

/**
 * Check if AI analysis is available (API key configured)
 */
export function isAIAvailable(): boolean {
  return !!getOpenAIApiKey();
}

/**
 * Get AI-suggested scraping rules based on file type patterns
 */
export async function suggestScrapingRules(
  patterns: AIPatternGroup[],
  documentType: string
): Promise<string[]> {
  const client = getOpenAIClient();
  
  if (!client) {
    return [];
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at creating regex patterns for file name extraction. Given file patterns found in a document, suggest regex patterns that could be used to extract similar files in the future. Return a JSON array of regex pattern strings.`
        },
        {
          role: 'user',
          content: `Document type: ${documentType}\n\nPatterns found:\n${patterns.map(p => `- ${p.pattern}: ${p.description}`).join('\n')}\n\nSuggest regex patterns for these file types:`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.patterns || parsed.regexPatterns || [];

  } catch (error) {
    logger.error('Error suggesting scraping rules', error);
    return [];
  }
}

