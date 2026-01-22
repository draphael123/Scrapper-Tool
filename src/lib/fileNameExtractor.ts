export interface ExtractedFileName {
  name: string;
  extension: string;
  line?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface PatternGroup {
  pattern: string;
  files: ExtractedFileName[];
  count: number;
  description?: string;
}

export interface ExtractionResult {
  totalFound: number;
  patterns: PatternGroup[];
  duplicates: string[];
  aiEnhanced?: boolean;
  summary?: string;
  documentType?: string;
}

// Common file extensions to detect
const FILE_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif',
  'pptx', 'ppt', 'rtf', 'xml', 'json', 'html', 'htm',
  'zip', 'rar', '7z', 'tar', 'gz',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
  'eml', 'msg', 'pst'
];

/**
 * Build regex pattern to match file names
 * Matches patterns like:
 * - filename.ext
 * - filename_123.ext
 * - filename-2023-01-01.ext
 * - 1099-MISC-2023.pdf
 * - W2_Employee_2023.pdf
 */
function buildFileNameRegex(): RegExp {
  const extPattern = FILE_EXTENSIONS.join('|');
  // Match file names with various naming conventions
  // Starts with alphanumeric or common prefixes, allows underscores, hyphens, dots, spaces
  // Must end with a valid file extension
  return new RegExp(
    `(?:^|[\\s"'(<\\[{,;:])` + // Start of string or preceding delimiter
    `([A-Za-z0-9_][A-Za-z0-9_\\-\\.\\s()\\[\\]]{0,200}` + // File name body (up to 200 chars)
    `\\.(?:${extPattern}))` + // File extension
    `(?=[\\s"'>)\\]},;:]|$)`, // End of string or following delimiter
    'gi'
  );
}

/**
 * Extract all file names from text
 */
export function extractFileNames(text: string): ExtractedFileName[] {
  const regex = buildFileNameRegex();
  const fileNames: ExtractedFileName[] = [];
  const seen = new Set<string>();
  
  const lines = text.split('\n');
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    
    // Reset regex for each line
    regex.lastIndex = 0;
    
    while ((match = regex.exec(line)) !== null) {
      const fileName = match[1]?.trim();
      if (fileName && fileName.length > 2) {
        // Clean up the file name
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
        
        // Track for duplicate detection
        if (cleanName.length > 2) {
          if (seen.has(cleanName.toLowerCase())) {
            // Mark as duplicate later
          }
          seen.add(cleanName.toLowerCase());
        }
      }
    }
  }
  
  return fileNames;
}

/**
 * Find duplicates in the extracted file names
 */
export function findDuplicates(text: string): string[] {
  const regex = buildFileNameRegex();
  const counts = new Map<string, number>();
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const fileName = match[1]?.trim().toLowerCase();
    if (fileName && fileName.length > 2) {
      counts.set(fileName, (counts.get(fileName) || 0) + 1);
    }
  }
  
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

/**
 * Identify the pattern of a file name by replacing variable parts with placeholders
 */
function identifyPattern(fileName: string): string {
  const parts = fileName.split('.');
  const extension = parts.pop() || '';
  const baseName = parts.join('.');
  
  // Replace sequences of digits with X placeholders
  let pattern = baseName
    // Replace date patterns YYYY-MM-DD or YYYYMMDD
    .replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, 'DATE')
    // Replace date patterns MM-DD-YYYY or MMDDYYYY
    .replace(/\d{2}[-_]?\d{2}[-_]?\d{4}/g, 'DATE')
    // Replace year patterns
    .replace(/(?:19|20)\d{2}/g, 'YYYY')
    // Replace sequences of 3+ digits
    .replace(/\d{3,}/g, 'XXX')
    // Replace sequences of 2 digits
    .replace(/\d{2}/g, 'XX')
    // Replace single digits
    .replace(/\d/g, 'X')
    // Replace single letters that look like sequence markers (A, B, C, etc.) - simpler approach
    .replace(/([-_])([A-Z])(?=[-_.]|$)/gi, '$1X')
    // Replace variable name parts (like John, Jane) after fixed prefixes
    .replace(/([-_])([A-Za-z]+)([-_])(YYYY|DATE|XXX|XX|X)/g, '$1VAR$3$4');
  
  return `${pattern}.${extension}`;
}

/**
 * Extract the common prefix from a file name (the static part before variable content)
 */
function extractPrefix(fileName: string): string {
  const parts = fileName.split('.');
  parts.pop(); // remove extension
  const baseName = parts.join('.');
  
  // Find where the variable content starts (numbers, single letters, dates)
  const prefixMatch = baseName.match(/^([A-Za-z]+[-_]?|[A-Z0-9]+[-_])/);
  return prefixMatch ? prefixMatch[0] : baseName.substring(0, 4);
}

/**
 * Calculate similarity between two patterns
 */
function patternSimilarity(p1: string, p2: string): number {
  if (p1 === p2) return 1;
  
  const longer = p1.length > p2.length ? p1 : p2;
  const shorter = p1.length > p2.length ? p2 : p1;
  
  if (longer.length === 0) return 1;
  
  // Simple prefix matching
  let matchLength = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) {
      matchLength++;
    } else {
      break;
    }
  }
  
  return matchLength / longer.length;
}

/**
 * Group file names by their naming pattern
 */
export function groupByPattern(fileNames: ExtractedFileName[]): PatternGroup[] {
  const patternMap = new Map<string, ExtractedFileName[]>();
  
  for (const file of fileNames) {
    const pattern = identifyPattern(file.name);
    const prefix = extractPrefix(file.name);
    
    // Create a grouping key that considers both pattern and prefix
    const groupKey = `${prefix}|${pattern}`;
    
    // Try to find a similar existing pattern
    let matchedKey: string | null = null;
    for (const existingKey of patternMap.keys()) {
      const [existingPrefix, existingPattern] = existingKey.split('|');
      
      // Group if prefixes match or patterns are very similar
      if (existingPrefix === prefix || patternSimilarity(pattern, existingPattern) > 0.85) {
        matchedKey = existingKey;
        break;
      }
    }
    
    if (matchedKey) {
      patternMap.get(matchedKey)!.push(file);
    } else {
      patternMap.set(groupKey, [file]);
    }
  }
  
  // Convert to array and sort by count (descending)
  const groups: PatternGroup[] = Array.from(patternMap.entries())
    .map(([key, files]) => {
      // Use the pattern part of the key for display
      const pattern = key.split('|')[1] || key;
      return {
        pattern,
        files,
        count: files.length,
      };
    })
    .sort((a, b) => b.count - a.count);
  
  // Move single-file groups to "Miscellaneous"
  const miscFiles: ExtractedFileName[] = [];
  const regularGroups: PatternGroup[] = [];
  
  for (const group of groups) {
    if (group.count === 1) {
      miscFiles.push(...group.files);
    } else {
      regularGroups.push(group);
    }
  }
  
  // Add miscellaneous group if there are any single files
  if (miscFiles.length > 0) {
    regularGroups.push({
      pattern: 'Miscellaneous',
      files: miscFiles,
      count: miscFiles.length,
    });
  }
  
  return regularGroups;
}

/**
 * Main extraction function that combines all steps
 */
export function analyzeDocument(text: string): ExtractionResult {
  const fileNames = extractFileNames(text);
  const duplicates = findDuplicates(text);
  const patterns = groupByPattern(fileNames);
  
  return {
    totalFound: fileNames.length,
    patterns,
    duplicates,
  };
}

/**
 * Export results to CSV format
 */
export function exportToCSV(result: ExtractionResult): string {
  const lines: string[] = [
    'Pattern,File Name,Extension,Is Duplicate',
  ];
  
  for (const group of result.patterns) {
    for (const file of group.files) {
      const isDuplicate = result.duplicates.includes(file.name.toLowerCase());
      lines.push(
        `"${group.pattern}","${file.name}","${file.extension}","${isDuplicate ? 'Yes' : 'No'}"`
      );
    }
  }
  
  return lines.join('\n');
}

