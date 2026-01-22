/**
 * File name and path sanitization utilities for security
 */

/**
 * Sanitize a file name to prevent path traversal and other security issues
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'unnamed-file';
  }

  // Remove null bytes
  let sanitized = fileName.replace(/\0/g, '');
  
  // Remove path separators and dangerous characters
  sanitized = sanitized.replace(/[\/\\\?\*\|"<>:]/g, '_');
  
  // Remove leading/trailing dots and spaces (Windows issue)
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Limit length to prevent buffer overflow issues
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, maxLength - ext.length);
    sanitized = name + ext;
  }
  
  // Ensure it's not empty
  if (!sanitized || sanitized.trim().length === 0) {
    sanitized = 'unnamed-file';
  }
  
  return sanitized;
}

/**
 * Validate and sanitize a file path (for ZIP extraction)
 */
export function sanitizeFilePath(filePath: string): { isValid: boolean; sanitized: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, sanitized: '' };
  }

  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    return { isValid: false, sanitized: '' };
  }

  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, '');
  
  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove leading slashes (prevent absolute paths)
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Remove dangerous characters but keep path structure
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '_');
  
  // Limit depth to prevent deep nesting attacks
  const parts = sanitized.split('/');
  if (parts.length > 10) {
    sanitized = parts.slice(0, 10).join('/');
  }
  
  return { isValid: true, sanitized };
}

/**
 * Validate file name doesn't contain dangerous patterns
 */
export function isFileNameSafe(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Check for path traversal
  if (fileName.includes('..') || fileName.includes('~')) {
    return false;
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return false;
  }

  // Check for reserved Windows names
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = fileName.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    return false;
  }

  return true;
}

/**
 * Extract and sanitize file extension
 */
export function sanitizeFileExtension(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  // Only allow alphanumeric characters in extensions
  return ext.replace(/[^a-z0-9]/g, '');
}

