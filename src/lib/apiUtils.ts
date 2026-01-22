/**
 * API utility functions for consistent error handling and responses
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  requestId?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      requestId,
    },
    { status }
  );
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  details?: unknown,
  requestId?: string
): NextResponse<ApiResponse> {
  logger.error(message, { code, status, details, requestId });

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      requestId,
    },
    { status }
  );
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  PARSE_ERROR: 'PARSE_ERROR',
  AI_ERROR: 'AI_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Handle API errors consistently
 */
export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse<ApiResponse> {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('too large') || error.message.includes('413')) {
      return errorResponse(
        'File size exceeds the maximum allowed limit',
        ErrorCodes.FILE_TOO_LARGE,
        413,
        undefined,
        requestId
      );
    }

    if (error.message.includes('Invalid file type') || error.message.includes('unsupported')) {
      return errorResponse(
        error.message,
        ErrorCodes.INVALID_FILE_TYPE,
        400,
        undefined,
        requestId
      );
    }

    if (error.message.includes('parse') || error.message.includes('Parse')) {
      return errorResponse(
        error.message,
        ErrorCodes.PARSE_ERROR,
        400,
        undefined,
        requestId
      );
    }

    // Generic error
    return errorResponse(
      error.message,
      ErrorCodes.INTERNAL_ERROR,
      500,
      undefined,
      requestId
    );
  }

  return errorResponse(
    'An unexpected error occurred',
    ErrorCodes.INTERNAL_ERROR,
    500,
    String(error),
    requestId
  );
}

