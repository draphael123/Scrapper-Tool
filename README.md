# FileScope - AI-Powered Document Pattern Analyzer

A web-based tool that extracts file names from uploaded PDF and Word documents, then intelligently groups them by naming patterns. Features both regex-based and AI-powered analysis.

## Features

- **Document Parsing**: Supports both PDF and Word (.docx) documents
- **Dual Analysis Modes**:
  - **Regex Mode**: Fast, deterministic pattern matching
  - **AI Mode**: GPT-4o-mini powered intelligent extraction with confidence scores
- **Pattern Grouping**: Automatically groups files by naming conventions
- **Drag & Drop Upload**: Easy file upload with drag-and-drop support
- **CSV Export**: Export analysis results to CSV format
- **Duplicate Detection**: Flags duplicate file names found in documents

## AI-Powered Analysis

When enabled, the AI system:
- Understands document context to find file names regex might miss
- Provides confidence scores (high/medium/low) for each extraction
- Identifies the document type (e.g., "File Index", "Audit Report")
- Generates human-readable pattern descriptions
- Creates a summary of findings

## Supported File Patterns

The tool detects various file name patterns including:
- Standard files: `filename.pdf`, `report.docx`
- Numeric sequences: `Invoice_001.pdf`, `Invoice_002.pdf`
- Date-based: `Report-2023-01-15.xlsx`, `Backup_20240101.zip`
- Tax documents: `1099-2023-001.pdf`, `W2_Employee_2023.pdf`
- Prefixed files: `INV-2024-0001.xlsx`, `RPT-Monthly.pdf`

## Tech Stack

- **Framework**: Next.js 16 with TypeScript
- **PDF Parsing**: pdf-parse
- **Word Parsing**: mammoth.js
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm
- OpenAI API key (optional, for AI features)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables (for AI features)
# Create a .env.local file with:
# OPENAI_API_KEY=your-api-key-here

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the project root:

```env
# OpenAI API Key for AI-powered file name extraction
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-api-key-here
```

Without an API key, the app will still work using regex-based analysis only.

### Testing Document Parsing

You can test the parsing logic with sample documents:

```bash
node scripts/testParsing.cjs [sample.pdf] [sample.docx]
```

Without arguments, it tests the file name extraction logic with sample text.

## How It Works

### Regex Mode (Default when no API key)
1. **Upload**: Drag & drop or select a PDF/Word document
2. **Parse**: Document text is extracted using pdf-parse or mammoth.js
3. **Extract**: Regex patterns scan for strings that look like file names
4. **Group**: Files are grouped by their naming pattern
5. **Display**: Results show organized groups with counts

### AI Mode (When API key configured)
1. **Upload**: Drag & drop or select a PDF/Word document
2. **Parse**: Document text is extracted
3. **AI Analysis**: GPT-4o-mini analyzes the full document context
4. **Smart Extraction**: AI identifies file names with confidence scores
5. **Intelligent Grouping**: AI creates meaningful pattern groups with descriptions
6. **Display**: Results include document type, summary, and confidence indicators

## Pattern Detection

### Regex-based (Fast)
- Replaces date patterns (YYYY-MM-DD, MMDDYYYY) with `DATE`
- Replaces year patterns (2023, 2024) with `YYYY`
- Replaces numeric sequences with `X` placeholders
- Groups files sharing common prefixes

### AI-based (Smart)
- Understands context and document structure
- Identifies patterns humans would recognize
- Provides descriptive pattern names
- Handles edge cases and unusual formats

## API Endpoints

### GET /api/analyze

Check if AI is available.

**Response**:
```json
{
  "aiAvailable": true
}
```

### POST /api/analyze

Analyzes an uploaded document and returns extracted file names.

**Request**: `multipart/form-data`
- `file`: The document to analyze
- `useAI`: "true" to use AI analysis (optional)
- `exportCSV`: "true" to get CSV output (optional)

**Response**:
```json
{
  "success": true,
  "fileName": "document.pdf",
  "fileType": "pdf",
  "pageCount": 5,
  "textLength": 12345,
  "aiAvailable": true,
  "aiUsed": true,
  "analysis": {
    "totalFound": 45,
    "patterns": [...],
    "duplicates": [...],
    "aiEnhanced": true,
    "summary": "Found 45 file names across 3 naming patterns...",
    "documentType": "File Index Report"
  }
}
```

## Project Structure

```
src/
├── app/
│   ├── api/analyze/route.ts    # File processing API
│   ├── globals.css             # Styling
│   ├── layout.tsx              # App layout
│   └── page.tsx                # Main UI component
└── lib/
    ├── documentParser.ts       # PDF & Word parsing
    ├── fileNameExtractor.ts    # Regex pattern detection
    └── aiAnalyzer.ts           # AI-powered analysis
```

## License

MIT
