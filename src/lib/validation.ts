/**
 * Runtime validation utilities using Zod-like patterns
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate file object
 */
export function validateFile(file: unknown): ValidationResult<File> {
  if (!file) {
    return { success: false, error: 'File is required' };
  }
  
  if (!(file instanceof File)) {
    return { success: false, error: 'Invalid file object' };
  }
  
  if (file.size === 0) {
    return { success: false, error: 'File is empty' };
  }
  
  if (file.size > 100 * 1024 * 1024) { // 100MB hard limit
    return { success: false, error: 'File is too large' };
  }
  
  return { success: true, data: file };
}

/**
 * Validate file name
 */
export function validateFileName(fileName: unknown): ValidationResult<string> {
  if (typeof fileName !== 'string') {
    return { success: false, error: 'File name must be a string' };
  }
  
  if (fileName.length === 0) {
    return { success: false, error: 'File name cannot be empty' };
  }
  
  if (fileName.length > 255) {
    return { success: false, error: 'File name is too long' };
  }
  
  return { success: true, data: fileName };
}

/**
 * Validate boolean from form data
 */
export function validateBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return defaultValue;
}

/**
 * Validate array of files
 */
export function validateFileArray(files: unknown): ValidationResult<File[]> {
  if (!Array.isArray(files)) {
    return { success: false, error: 'Files must be an array' };
  }
  
  if (files.length === 0) {
    return { success: false, error: 'At least one file is required' };
  }
  
  const validFiles: File[] = [];
  for (const file of files) {
    const result = validateFile(file);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    validFiles.push(result.data!);
  }
  
  return { success: true, data: validFiles };
}

