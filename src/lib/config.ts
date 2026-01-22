/**
 * Application configuration and environment variable validation
 */

/**
 * Validates and returns the OpenAI API key from environment variables
 */
export function getOpenAIApiKey(): string | null {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Validate API key format (OpenAI keys start with 'sk-')
  if (apiKey && apiKey.trim().length > 0) {
    if (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-')) {
      return apiKey.trim();
    }
    console.warn('OpenAI API key format appears invalid (should start with "sk-" or "sk-proj-")');
  }
  
  return apiKey?.trim() || null;
}

/**
 * Check if AI features are available
 */
export function isAIAvailable(): boolean {
  return !!getOpenAIApiKey();
}

/**
 * Application constants
 */
export const CONFIG = {
  // File size limits (in bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_BATCH_SIZE: 10 * 1024 * 1024, // 10MB total for batch
  MAX_ZIP_SIZE: 50 * 1024 * 1024, // 50MB for ZIP files
  
  // Supported file types
  SUPPORTED_EXTENSIONS: ['pdf', 'docx'] as const,
  SUPPORTED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  
  // API timeouts (in seconds)
  DEFAULT_TIMEOUT: 60,
  BATCH_TIMEOUT: 120,
  ZIP_TIMEOUT: 60,
  
  // AI configuration
  AI_MAX_CHARS: 100000, // ~25k tokens
  AI_TEMPERATURE: 0.1,
  AI_MODEL: 'gpt-4o-mini',
  
  // Processing limits
  MAX_BATCH_FILES: 100, // Maximum files in a batch
  MAX_RETRIES: 2, // PDF parsing retries
} as const;

/**
 * Validate file type
 */
export function isValidFileType(file: File | { name: string; type?: string }): boolean {
  const ext = file.name.toLowerCase().split('.').pop();
  const isValidExt = ext && CONFIG.SUPPORTED_EXTENSIONS.includes(ext as any);
  const isValidMime = file.type && CONFIG.SUPPORTED_MIME_TYPES.includes(file.type as any);
  
  return isValidExt || isValidMime || false;
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number, maxSize: number = CONFIG.MAX_FILE_SIZE): boolean {
  return size > 0 && size <= maxSize;
}

