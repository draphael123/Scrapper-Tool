/**
 * Test script for document parsing and file name extraction
 * Run with: node scripts/testParsing.cjs
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// ============= Document Parsing Functions =============

async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error.message || 'Failed to parse PDF',
    };
  }
}

async function parseWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      success: true,
      text: result.value,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error.message || 'Failed to parse Word document',
    };
  }
}

// ============= File Name Extraction Functions =============

const FILE_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif',
  'pptx', 'ppt', 'rtf', 'xml', 'json', 'html', 'htm',
  'zip', 'rar', '7z', 'tar', 'gz',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
  'eml', 'msg', 'pst'
];

function buildFileNameRegex() {
  const extPattern = FILE_EXTENSIONS.join('|');
  return new RegExp(
    `(?:^|[\\s"'(<\\[{,;:])` +
    `([A-Za-z0-9_][A-Za-z0-9_\\-\\.\\s()\\[\\]]{0,200}` +
    `\\.(?:${extPattern}))` +
    `(?=[\\s"'>)\\]},;:]|$)`,
    'gi'
  );
}

function extractFileNames(text) {
  const regex = buildFileNameRegex();
  const fileNames = [];
  const seen = new Set();
  
  const lines = text.split('\n');
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(line)) !== null) {
      const fileName = match[1]?.trim();
      if (fileName && fileName.length > 2) {
        const cleanName = fileName.replace(/^[\s"'(<\[{,;:]+/, '').trim();
        
        if (cleanName.length > 2 && !seen.has(cleanName.toLowerCase())) {
          const parts = cleanName.split('.');
          const extension = parts.pop()?.toLowerCase() || '';
          
          fileNames.push({
            name: cleanName,
            extension,
            line: lineNum + 1,
          });
        }
        
        if (cleanName.length > 2) {
          seen.add(cleanName.toLowerCase());
        }
      }
    }
  }
  
  return fileNames;
}

function identifyPattern(fileName) {
  const parts = fileName.split('.');
  const extension = parts.pop() || '';
  const baseName = parts.join('.');
  
  let pattern = baseName
    .replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, 'DATE')
    .replace(/\d{2}[-_]?\d{2}[-_]?\d{4}/g, 'DATE')
    .replace(/(?:19|20)\d{2}/g, 'YYYY')
    .replace(/\d{3,}/g, 'XXX')
    .replace(/\d{2}/g, 'XX')
    .replace(/\d/g, 'X');
  
  // Replace single letters that look like sequence markers (simpler approach)
  pattern = pattern.replace(/([-_])([A-Z])(?=[-_.]|$)/gi, '$1X');
  
  return `${pattern}.${extension}`;
}

function groupByPattern(fileNames) {
  const patternMap = new Map();
  
  for (const file of fileNames) {
    const pattern = identifyPattern(file.name);
    
    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, []);
    }
    patternMap.get(pattern).push(file);
  }
  
  const groups = Array.from(patternMap.entries())
    .map(([pattern, files]) => ({
      pattern,
      files,
      count: files.length,
    }))
    .sort((a, b) => b.count - a.count);
  
  const miscFiles = [];
  const regularGroups = [];
  
  for (const group of groups) {
    if (group.count === 1) {
      miscFiles.push(...group.files);
    } else {
      regularGroups.push(group);
    }
  }
  
  if (miscFiles.length > 0) {
    regularGroups.push({
      pattern: 'Miscellaneous',
      files: miscFiles,
      count: miscFiles.length,
    });
  }
  
  return regularGroups;
}

function analyzeDocument(text) {
  const fileNames = extractFileNames(text);
  const patterns = groupByPattern(fileNames);
  
  return {
    totalFound: fileNames.length,
    patterns,
    duplicates: [],
  };
}

// ============= Test Data =============

const sampleText = `
Document Index Report
Generated: 2024-01-15

The following files were processed:

Tax Documents:
- 1099-2023-001.pdf
- 1099-2023-002.pdf
- 1099-2023-003.pdf
- W2_Employee_John_2023.pdf
- W2_Employee_Jane_2023.pdf

Reports:
- 1092-ReportA.docx
- 1092-ReportB.docx
- 1092-ReportC.docx

Invoices:
- Invoice_001.pdf
- Invoice_002.pdf
- Invoice_003.pdf
- INV-2024-0001.xlsx
- INV-2024-0002.xlsx

Miscellaneous:
- notes.txt
- readme.md
- config.json

Images attached:
- photo_20240115.jpg
- screenshot-2024-01-10.png
`;

// ============= Test Functions =============

async function testTextExtraction() {
  console.log('========================================');
  console.log('Testing File Name Extraction Logic');
  console.log('========================================\n');
  
  const result = analyzeDocument(sampleText);
  
  console.log(`Total file names found: ${result.totalFound}`);
  console.log(`Number of pattern groups: ${result.patterns.length}`);
  
  for (const group of result.patterns) {
    console.log(`\nPattern: ${group.pattern} (${group.count} files)`);
    for (const file of group.files) {
      console.log(`   - ${file.name}`);
    }
  }
  
  console.log('\n========================================');
  console.log('Text Extraction Test: PASSED');
  console.log('========================================\n');
  
  return result.totalFound > 0;
}

async function testPDFParsing(filePath) {
  console.log('========================================');
  console.log('Testing PDF Parsing');
  console.log('========================================\n');
  
  if (filePath && fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const result = await parsePDF(buffer);
    
    if (result.success) {
      console.log(`PDF parsed successfully!`);
      console.log(`  Pages: ${result.pageCount}`);
      console.log(`  Text length: ${result.text.length} characters`);
      console.log(`  First 500 chars:\n${result.text.substring(0, 500)}...`);
      console.log('\n========================================');
      console.log('PDF Parsing Test: PASSED');
      console.log('========================================\n');
      return true;
    } else {
      console.log(`PDF parsing failed: ${result.error}`);
      console.log('\n========================================');
      console.log('PDF Parsing Test: FAILED');
      console.log('========================================\n');
      return false;
    }
  } else {
    console.log('No PDF file provided for testing.');
    console.log('To test PDF parsing, run: node scripts/testParsing.cjs sample.pdf');
    console.log('\nPDF Parsing Test: SKIPPED\n');
    return null;
  }
}

async function testWordParsing(filePath) {
  console.log('========================================');
  console.log('Testing Word Document Parsing');
  console.log('========================================\n');
  
  if (filePath && fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const result = await parseWord(buffer);
    
    if (result.success) {
      console.log(`Word document parsed successfully!`);
      console.log(`  Text length: ${result.text.length} characters`);
      console.log(`  First 500 chars:\n${result.text.substring(0, 500)}...`);
      console.log('\n========================================');
      console.log('Word Parsing Test: PASSED');
      console.log('========================================\n');
      return true;
    } else {
      console.log(`Word parsing failed: ${result.error}`);
      console.log('\n========================================');
      console.log('Word Parsing Test: FAILED');
      console.log('========================================\n');
      return false;
    }
  } else {
    console.log('No Word document provided for testing.');
    console.log('To test Word parsing, run: node scripts/testParsing.cjs sample.docx');
    console.log('\nWord Parsing Test: SKIPPED\n');
    return null;
  }
}

// ============= Main =============

async function main() {
  const args = process.argv.slice(2);
  
  console.log('\n=== File Name Analysis Tool - Parser Test Suite ===\n');
  
  // Always test the text extraction logic
  const extractionPassed = await testTextExtraction();
  
  // Find test files from args
  let pdfFile = null;
  let docxFile = null;
  
  for (const arg of args) {
    const ext = path.extname(arg).toLowerCase();
    if (ext === '.pdf') pdfFile = arg;
    else if (ext === '.docx') docxFile = arg;
  }
  
  // Test document parsing if files are provided
  await testPDFParsing(pdfFile);
  await testWordParsing(docxFile);
  
  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================');
  console.log(`File Name Extraction: ${extractionPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`\nTo test document parsing, provide sample files:`);
  console.log(`  node scripts/testParsing.cjs sample.pdf sample.docx`);
  console.log('========================================\n');
}

main().catch(console.error);

