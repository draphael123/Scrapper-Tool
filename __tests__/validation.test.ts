/**
 * Tests for validation utilities
 */

import { validateFile, validateFileName, validateFileArray } from '../src/lib/validation';

describe('validateFile', () => {
  it('should reject null/undefined', () => {
    expect(validateFile(null).success).toBe(false);
    expect(validateFile(undefined).success).toBe(false);
  });

  it('should reject non-File objects', () => {
    expect(validateFile({ name: 'test.pdf' }).success).toBe(false);
    expect(validateFile('string').success).toBe(false);
  });

  it('should reject empty files', () => {
    const emptyFile = new File([], 'test.pdf');
    expect(validateFile(emptyFile).success).toBe(false);
  });

  it('should accept valid files', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    expect(result.success).toBe(true);
    expect(result.data).toBe(file);
  });
});

describe('validateFileName', () => {
  it('should reject non-strings', () => {
    expect(validateFileName(null).success).toBe(false);
    expect(validateFileName(123).success).toBe(false);
  });

  it('should reject empty strings', () => {
    expect(validateFileName('').success).toBe(false);
  });

  it('should accept valid file names', () => {
    expect(validateFileName('test.pdf').success).toBe(true);
    expect(validateFileName('file-name_123.docx').success).toBe(true);
  });
});

describe('validateFileArray', () => {
  it('should reject non-arrays', () => {
    expect(validateFileArray(null).success).toBe(false);
    expect(validateFileArray({}).success).toBe(false);
  });

  it('should reject empty arrays', () => {
    expect(validateFileArray([]).success).toBe(false);
  });

  it('should accept valid file arrays', () => {
    const files = [
      new File(['content1'], 'test1.pdf'),
      new File(['content2'], 'test2.pdf'),
    ];
    const result = validateFileArray(files);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(files);
  });
});

