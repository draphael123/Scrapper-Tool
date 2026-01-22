// Shared types for the application

export interface AnalysisOptions {
  // File Extension Filtering
  extensionFilter: string[]; // Empty = all, or specific extensions like ['pdf', 'docx']
  
  // Pattern Grouping
  minGroupSize: number; // Minimum files to form a pattern group (default: 2)
  
  // AI Options
  confidenceThreshold: 'all' | 'medium' | 'high'; // Minimum confidence for AI results
  
  // Display Options
  sortBy: 'count' | 'name' | 'extension';
  sortOrder: 'asc' | 'desc';
  showLineNumbers: boolean;
  
  // Duplicate Handling
  duplicateHandling: 'show' | 'highlight' | 'hide';
  
  // Custom Patterns (prefixes to look for)
  customPrefixes: string[];
  
  // Case Sensitivity
  caseSensitive: boolean;
}

export const DEFAULT_OPTIONS: AnalysisOptions = {
  extensionFilter: [],
  minGroupSize: 2,
  confidenceThreshold: 'all',
  sortBy: 'count',
  sortOrder: 'desc',
  showLineNumbers: false,
  duplicateHandling: 'highlight',
  customPrefixes: [],
  caseSensitive: false,
};

// Common file extension categories for filtering
export const EXTENSION_CATEGORIES = {
  documents: ['pdf', 'docx', 'doc', 'rtf', 'txt', 'odt'],
  spreadsheets: ['xlsx', 'xls', 'csv', 'ods'],
  presentations: ['pptx', 'ppt', 'odp'],
  images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
  video: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'],
  data: ['xml', 'json', 'yaml', 'yml'],
  email: ['eml', 'msg', 'pst'],
};

export const ALL_EXTENSIONS = Object.values(EXTENSION_CATEGORIES).flat();

