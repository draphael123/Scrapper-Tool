/**
 * Tests for file name sanitization
 */

import { sanitizeFileName, sanitizeFilePath, isFileNameSafe } from '../src/lib/sanitize';

describe('sanitizeFileName', () => {
  it('should sanitize path traversal attempts', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toBe('___etc_passwd');
    expect(sanitizeFileName('..\\..\\file.pdf')).toBe('__file.pdf');
  });

  it('should remove dangerous characters', () => {
    expect(sanitizeFileName('file<>:"|?*.pdf')).toBe('file_______.pdf');
    expect(sanitizeFileName('file/name.pdf')).toBe('file_name.pdf');
  });

  it('should handle null bytes', () => {
    expect(sanitizeFileName('file\0name.pdf')).toBe('filename.pdf');
  });

  it('should limit length', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    const result = sanitizeFileName(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('should handle empty strings', () => {
    expect(sanitizeFileName('')).toBe('unnamed-file');
    expect(sanitizeFileName('   ')).toBe('unnamed-file');
  });
});

describe('sanitizeFilePath', () => {
  it('should reject path traversal', () => {
    expect(sanitizeFilePath('../file.pdf').isValid).toBe(false);
    expect(sanitizeFilePath('../../file.pdf').isValid).toBe(false);
    expect(sanitizeFilePath('~/.bashrc').isValid).toBe(false);
  });

  it('should sanitize valid paths', () => {
    const result = sanitizeFilePath('folder/file.pdf');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('folder/file.pdf');
  });

  it('should remove leading slashes', () => {
    const result = sanitizeFilePath('/absolute/path.pdf');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).not.toStartWith('/');
  });

  it('should limit depth', () => {
    const deepPath = Array(15).fill('folder').join('/') + '/file.pdf';
    const result = sanitizeFilePath(deepPath);
    expect(result.sanitized.split('/').length).toBeLessThanOrEqual(10);
  });
});

describe('isFileNameSafe', () => {
  it('should detect unsafe file names', () => {
    expect(isFileNameSafe('../file.pdf')).toBe(false);
    expect(isFileNameSafe('file\0name.pdf')).toBe(false);
    expect(isFileNameSafe('CON.pdf')).toBe(false); // Windows reserved
  });

  it('should accept safe file names', () => {
    expect(isFileNameSafe('document.pdf')).toBe(true);
    expect(isFileNameSafe('file-name_123.pdf')).toBe(true);
  });
});

